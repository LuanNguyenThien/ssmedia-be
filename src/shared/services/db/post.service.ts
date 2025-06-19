import { IPostDocument, IGetPostsQuery, IQueryComplete, IQueryDeleted } from '@post/interfaces/post.interface';
import { PostModel } from '@post/models/post.schema';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserModel } from '@user/models/user.schema';
import { Query, UpdateQuery } from 'mongoose';
import { cache } from '@service/redis/cache';
import { textServiceAI } from '@api-serverAI/text/text.AIservice';
import mongoose from 'mongoose';

const postCache = cache.postCache;
const userbehaviorCache = cache.userBehaviorCache;

class PostService {
  public async addPostToDB(userId: string, createdPost: IPostDocument): Promise<void> {
    if (createdPost.groupId !== null && createdPost.groupId !== undefined) {
      createdPost.isGroupPost = true;
    }
    const post: Promise<IPostDocument> = PostModel.create(createdPost);
    if (createdPost.type !== 'answer') {
      const user: UpdateQuery<IUserDocument> = UserModel.updateOne({ _id: userId }, { $inc: { postsCount: 1 } });
      await Promise.all([post, user]);
    } else {
      const postUpdate = await PostModel.findOneAndUpdate(
        { _id: createdPost.questionId },
        [
          {
            $set: {
              answersCount: {
                $cond: {
                  if: { $ifNull: ['$answersCount', false] }, // Nếu field tồn tại
                  then: { $add: ['$answersCount', 1] }, // Increment
                  else: 1 // Set = 1 nếu field không tồn tại
                }
              }
            }
          }
        ],
        { new: true }
      );
      await postCache.updatePostPropertyInCache(createdPost.questionId as string, 'answersCount', postUpdate?.answersCount || 0);
    }
  }

  public async getPostById(postId: string): Promise<IPostDocument | null> {
    const post: IPostDocument | null = await PostModel.findById(postId).exec();
    return post;
  }

  public async getAnswersForQuestion(questionId: string, skip: number = 0, limit: number = 10): Promise<IPostDocument[]> {
    const answers = await PostModel.aggregate([
      {
        $match: {
          questionId: new mongoose.Types.ObjectId(questionId),
          type: 'answer'
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'User',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          userId: 1,
          type: 1,
          questionId: 1,
          username: 1,
          email: 1,
          avatarColor: 1,
          profilePicture: 1,
          post: 1,
          htmlPost: 1,
          bgColor: 1,
          feelings: 1,
          privacy: 1,
          gifUrl: 1,
          commentsCount: 1,
          imgVersion: 1,
          imgId: 1,
          videoId: 1,
          videoVersion: 1,
          createdAt: 1,
          reactions: 1
        }
      }
    ]);

    return answers;
  }

  public async getAnswerCount(questionId: string): Promise<number> {
    const count: number = await PostModel.countDocuments({ questionId: new mongoose.Types.ObjectId(questionId), type: 'answer' });
    return count;
  }

  public async getUserAnswers(userId: string, skip: number = 0, limit: number = 10): Promise<IPostDocument[]> {
    const answers: IPostDocument[] = await PostModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          type: 'answer'
        }
      },
      {
        $lookup: {
          from: 'Post',
          localField: 'questionId',
          foreignField: '_id',
          as: 'questionContext'
        }
      },
      {
        $unwind: {
          path: '$questionContext',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'User',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      // {
      //   $addFields: {
      //     username: '$user.username',
      //     uId: '$user.uId',
      //     email: '$user.email',
      //     avatarColor: '$user.avatarColor',
      //     profilePicture: '$user.profilePicture'
      //   }
      // },
      {
        $project: {
          user: 0 // Remove user object to avoid duplication
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    return answers;
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

    postQuery.isHidden = { $ne: true };
    postQuery.isGroupPost = { $ne: true }; // Chỉ lấy các bài viết không thuộc nhóm
    postQuery.type = { $ne: 'answer' }; // Loại trừ các bài viết là câu trả lời

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
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    return count;
  }

  public async postsCountAdmin(): Promise<number> {
    const count: number = await PostModel.find().countDocuments();
    return count;
  }

  public async deleteAnswer(answerId: string, questionId: string): Promise<void> {
    const deleteAnswer: Query<IQueryComplete & IQueryDeleted, IPostDocument> = PostModel.deleteOne({ _id: answerId });
    const decrementAnswerCount: UpdateQuery<IPostDocument> = PostModel.updateOne(
      { _id: questionId },
      { $inc: { answersCount: -1 } }
    );
    await Promise.all([deleteAnswer, decrementAnswerCount]);
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

  public async getPostsforUserByVector(userId: string, mongoSkip: number, mongoLimit: number): Promise<IPostDocument[]> {
    const user: IUserDocument | null = await UserModel.findById(userId);
    if (!user) {
      return [];
    } else {
      let userVector: number[] = user.user_vector as number[];
      if (user?.personalizeSettings?.allowPersonalize !== false) {
        const userHobbies: string = (user.user_hobbies?.personal + ' ' + user.user_hobbies?.subject) as string;
        console.log(userVector);
        const userInterest: string[] = await userbehaviorCache.getUserInterests(userId);
        console.log('User interests:', userInterest);
        if (userInterest.length > 0 || userVector.length === 0) {
          let combinedText = '';
          if (user.quote || user.school || user.work || user.location) {
            combinedText = `${user.quote || ''}. ${user.school || ''}. ${user.work || ''}. ${user.location || ''}`;
          }
          let response;
          if (userHobbies && userHobbies.trim().length > 0) {
            response = await textServiceAI.vectorizeText({ query: combinedText, userInterest, userHobbies });
          } else {
            if (combinedText.trim().length === 0 && userInterest.length === 0) {
              return await postCache.getTrendingPosts(mongoSkip, mongoSkip + mongoLimit - 1);
            }
            response = await textServiceAI.vectorizeText({ query: combinedText, userInterest });
            await UserModel.updateOne({ _id: userId }, { $set: { user_hobbies: { personal: response.related_topics } } });
          }
          const updatedUserVector: number[] = response.vector;
          await UserModel.updateOne({ _id: userId }, { $set: { user_vector: updatedUserVector } });
          userVector = updatedUserVector;
        }
      }
      if (!userVector || userVector.length === 0) {
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
          numCandidates: mongoSkip !== undefined && mongoLimit !== undefined ? allCachedPosts.length + mongoLimit * 5 : 200,
          limit: mongoSkip !== undefined && mongoLimit !== undefined ? allCachedPosts.length + mongoLimit * 1.5 : 10,
          filter: {
            privacy: { $ne: 'Private' },
            isHidden: { $ne: true },
            type: { $ne: 'answer' }, // Loại trừ các bài viết là câu trả lời
            isGroupPost: { $ne: true } // Chỉ lấy các bài viết không thuộc nhóm
          }
        }
      } as any,
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
      }
    ];
    // console.log('Pipeline:', JSON.stringify(pipeline, null, 2));

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
      console.log('Mongo posts:', mongoPosts.length);
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
  public async acceptPost(postId: string): Promise<IPostDocument | null> {
    const post = await PostModel.findByIdAndUpdate(
      postId,
      {
        status: 'accepted'
      },
      { new: true }
    );
    return post;
  }

  public async declinePost(postId: string): Promise<IPostDocument | null> {
    const post = await PostModel.findByIdAndUpdate(
      postId,
      {
        status: 'declined'
      },
      { new: true }
    );
    return post;
  }

  public async getHiddenPosts(skip = 0, limit = 5): Promise<{ posts: IPostDocument[]; total: number }> {
    const [posts, total] = await Promise.all([
      PostModel.find({ isHidden: true }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      PostModel.countDocuments({ isHidden: true })
    ]);

    return { posts, total };
  }

  public async unhidePost(postId: string): Promise<void> {
    const result = await PostModel.updateOne({ _id: postId }, { $set: { isHidden: false } });

    if (result.matchedCount === 0) {
      throw new Error('Post not found or already visible');
    }
  }

  public async getPostsByGroupOnly(groupId: string, page: number, limit: number): Promise<{ posts: IPostDocument[]; totalPosts: number }> {
    const skip = (page - 1) * limit;
    const query = { groupId };

    const posts = await PostModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const totalPosts = await PostModel.countDocuments(query);

    return { posts, totalPosts };
  }

  public async getPostsAcceptByGroup(
    groupId: string,
    page: number,
    limit: number
  ): Promise<{ posts: IPostDocument[]; totalPosts: number }> {
    const skip = (page - 1) * limit;

    const query = {
      groupId,
      status: 'accepted',
      privacy: 'Public'
      // Chỉ lấy những post có status là "accept"
    };

    const posts = await PostModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const totalPosts = await PostModel.countDocuments(query);

    return { posts, totalPosts };
  }

  public async getPostsPendingByGroup(
    groupId: string,
    page: number,
    limit: number
  ): Promise<{ posts: IPostDocument[]; totalPosts: number }> {
    const skip = (page - 1) * limit;

    const query = {
      groupId,
      status: 'pending' // Chỉ lấy những post có status là "accept"
    };

    const posts = await PostModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const totalPosts = await PostModel.countDocuments(query);

    return { posts, totalPosts };
  }
}

export const postService: PostService = new PostService();
