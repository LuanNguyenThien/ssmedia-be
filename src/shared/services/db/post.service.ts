import { IPostDocument, IGetPostsQuery, IQueryComplete, IQueryDeleted } from '@post/interfaces/post.interface';
import { PostModel } from '@post/models/post.schema';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserModel } from '@user/models/user.schema';
import { Query, UpdateQuery } from 'mongoose';
import { cache } from '@service/redis/cache';

const postCache = cache.postCache;

class PostService {
  public async addPostToDB(userId: string, createdPost: IPostDocument): Promise<void> {
    const post: Promise<IPostDocument> = PostModel.create(createdPost);
    const user: UpdateQuery<IUserDocument> = UserModel.updateOne({ _id: userId }, { $inc: { postsCount: 1 } });
    await Promise.all([post, user]);
  }

  public async getPostById(postId: string): Promise<IPostDocument | null> {
    const post: IPostDocument | null = await PostModel.findById(postId).exec();
    return post;
  }

  public async getPosts(query: IGetPostsQuery, skip = 0, limit = 0, sort: Record<string, 1 | -1>): Promise<IPostDocument[]> {
    let postQuery: any = {};
    if (query?.imgId && query?.gifUrl) {
      postQuery = { $or: [{ imgId: { $ne: '' } }, { gifUrl: { $ne: '' } }] };
    } else if (query?.videoId) {
      postQuery = { $or: [{ videoId: { $ne: '' } }] };
    } else {
      postQuery = query;
    }

    // Xử lý lọc theo ngày
    if (query.startDate || query.endDate) {
      postQuery.createdAt = {};
      if (query.startDate) {
        postQuery.createdAt.$gte = query.startDate;
      }
      if (query.endDate) {
        postQuery.createdAt.$lte = query.endDate;
      }
    }

    const posts: IPostDocument[] = await PostModel.aggregate([{ $match: postQuery }, { $sort: sort }, { $skip: skip }, { $limit: limit }]);
    return posts;
  }

  public async postsCount(): Promise<number> {
    const count: number = await PostModel.find({ privacy: { $ne: 'Private' } }).countDocuments();
    return count;
  }
  public async countPostsToday(): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const count = await PostModel.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    return count;
  }

  public async deletePost(postId: string, userId: string): Promise<void> {
    const deletePost: Query<IQueryComplete & IQueryDeleted, IPostDocument> = PostModel.deleteOne({ _id: postId });
    // delete reactions here
    const decrementPostCount: UpdateQuery<IUserDocument> = UserModel.updateOne({ _id: userId }, { $inc: { postsCount: -1 } });
    await Promise.all([deletePost, decrementPostCount]);
  }

  public async editPost(postId: string, updatedPost: IPostDocument): Promise<void> {
    const updatePost: UpdateQuery<IPostDocument> = PostModel.updateOne({ _id: postId }, { $set: updatedPost });
    await Promise.all([updatePost]);
  }

  public async getPostsforUserByVector(userId: string, mongoSkip: number, mongoLimit: number): Promise<IPostDocument[]> {
    const user: IUserDocument | null = await UserModel.findById(userId);
    if (!user) {
      return [];
    } else {
      const userVector: number[] = user.user_vector as number[];
      console.log(userVector);
      if (userVector !== undefined && userVector.length === 0) {
        const posts = await postCache.getTrendingPosts(mongoSkip, mongoSkip + mongoLimit - 1);
        return posts;
      }
      const posts = await this.searchPostsByVector(userVector, mongoSkip, mongoLimit, userId);
      return posts;
    }
  }

  public async searchPostsByVector(
    queryVector: number[],
    mongoSkip?: number,
    mongoLimit?: number,
    userId?: string
  ): Promise<IPostDocument[]> {
    // const pipeline: (PipelineStage | PipelineStage.CustomStages)[] = [
    //   {
    //     $vectorSearch: {
    //       index: "vectorPost_index",
    //       path: "post_embedding",
    //       queryVector: queryVector,
    //       numCandidates: 25,
    //       limit: 3
    //     }
    //   },
    //   {
    //     $project: {
    //       _id: 1,
    //       username: 1,
    //       post: 1,
    //       score: {
    //         $meta: 'vectorSearchScore'
    //       }
    //     }
    //   },
    //   {
    //     $sort: {
    //       score: -1  // Sắp xếp theo điểm liên quan
    //     }
    //   }
    // ];
    let allCachedPosts: IPostDocument[] = [];
    if (mongoLimit !== undefined && mongoSkip !== undefined) {
      allCachedPosts = await postCache.getAllPostsforUserFromCache(userId as string);
    }
    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: 'vectorPost_index',
          path: 'post_embedding',
          queryVector: queryVector,
          numCandidates: mongoSkip !== undefined && mongoLimit !== undefined ? allCachedPosts.length + mongoLimit + 50 : 100,
          limit: mongoSkip !== undefined && mongoLimit !== undefined ? allCachedPosts.length + mongoLimit : 10
        }
      } as any,
      {
        $match: {
          privacy: { $ne: 'Private' } // Lọc các bài post có privacy khác 'Private'
        }
      },
      {
        $project: {
          analysis: 0,
          post_embedding: 0,
          score: {
            $meta: 'vectorSearchScore'
          }
        }
      },
      {
        $sort: {
          score: -1 // Sắp xếp theo điểm liên quan
        }
      }
    ];

    const mongoPosts = await PostModel.aggregate(pipeline).exec();
    if (mongoSkip !== undefined && mongoLimit !== undefined) {
      // pipeline.push(
      //   {
      //     $skip: mongoSkip  // Bỏ qua các kết quả trước đó
      //   },
      //   {
      //     $limit: mongoLimit  // Giới hạn số lượng kết quả trả về
      //   }
      // );
      const combinedPosts = [...allCachedPosts, ...mongoPosts];
      const uniquePosts = Array.from(new Set(combinedPosts.map((post) => post._id.toString()))).map((id) =>
        combinedPosts.find((post) => post._id.toString() === id)
      );

      return uniquePosts.slice(allCachedPosts.length as number, ((allCachedPosts.length as number) + mongoLimit) as number);
    }
    return mongoPosts;
  }

  public async hidePost(postId: string, reason: string): Promise<IPostDocument | null> {
    const post = await PostModel.findByIdAndUpdate(
      postId,
      {
        isHidden: true,
        hiddenReason: reason,
        hiddenAt: new Date()
      },
      { new: true }
    );
    return post;
  }

  public async getHiddenPosts(skip = 0, limit = 10): Promise<IPostDocument[]> {
    const posts = await PostModel.find({ isHidden: true })
      .sort({ createdAt: -1 }) // sắp xếp mới nhất
      .skip(skip)
      .limit(limit)
      .exec();
    return posts;
  }

  public async unhidePost(postId: string): Promise<void> {
    const result = await PostModel.updateOne({ _id: postId }, { $set: { isHidden: false } });

    if (result.matchedCount === 0) {
      throw new Error('Post not found or already visible');
    }
  }
}

export const postService: PostService = new PostService();
