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

  public async deletePost(postId: string, userId: string): Promise<void> {
    const deletePost: Query<IQueryComplete & IQueryDeleted, IPostDocument> = PostModel.deleteOne({ _id: postId });
    // delete reactions here
    const decrementPostCount: UpdateQuery<IUserDocument> = UserModel.updateOne({ _id: userId }, { $inc: { postsCount: -1 } });
    await Promise.all([deletePost, decrementPostCount]);
  }

  public async editPost(postId: string, updatedPost: Partial<IPostDocument>): Promise<void> {
    const updatePost: UpdateQuery<IPostDocument> = PostModel.updateOne({ _id: postId }, { $set: updatedPost });
    await Promise.all([updatePost]);
  }

  public async getPostsforUserByVector(userId: string, skip: number = 0, limit: number = 10): Promise<IPostDocument[]> {
    try {
      const user: IUserDocument | null = await UserModel.findById(userId);
      if (!user) {
        // If user not found, return recent posts as fallback
        return this.getPosts({}, skip, limit, { createdAt: -1 });
      }
      
      const userVector: number[] = user.user_vector as number[];
      
      // If user has no vector (no interests/preferences), return trending posts
      if (!userVector || userVector.length === 0) {
        console.log(`User ${userId} has no vector, returning trending posts instead`);
        return this.getPosts({}, skip, limit, { createdAt: -1 });
      }
      
      // Get personalized posts using vector similarity
      return this.searchPostsByVector(userVector, skip, limit);
    } catch (error) {
      console.error('Error in getPostsforUserByVector:', error);
      // Fallback to recent posts if there's an error
      return this.getPosts({}, skip, limit, { createdAt: -1 });
    }
  }

  public async searchPostsByVector(
    queryVector: number[],
    skip: number = 0,
    limit: number = 10
  ): Promise<IPostDocument[]> {
    try {
      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: 'vectorPost_index',
            path: 'post_embedding',
            queryVector: queryVector,
            numCandidates: skip + limit + 100, // Get enough candidates to handle skip + limit
            limit: skip + limit // Get enough results to handle the skip
          }
        } as any,
        {
          $match: {
            privacy: { $ne: 'Private' }, // Filter out private posts
            isHidden: { $ne: true }      // Filter out hidden posts
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
            score: -1 // Sort by relevance score
          }
        },
        {
          $skip: skip
        },
        {
          $limit: limit
        }
      ];

      const posts = await PostModel.aggregate(pipeline).exec();
      return posts;
    } catch (error) {
      console.error('Error in searchPostsByVector:', error);
      // If vector search fails, fallback to regular post query
      return this.getPosts({}, skip, limit, { createdAt: -1 });
    }
  }

  public async hidePost(postId: string): Promise<void> {
    await PostModel.updateOne({ _id: postId }, { $set: { isHidden: true } });
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
