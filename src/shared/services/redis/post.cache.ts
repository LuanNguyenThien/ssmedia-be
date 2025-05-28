import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { config } from '@root/config';
import { ServerError } from '@global/helpers/error-handler';
import { ISavePostToCache, IPostDocument } from '@post/interfaces/post.interface';
import { Helpers } from '@global/helpers/helpers';
import { RedisCommandRawReply } from '@redis/client/dist/lib/commands';
import { IReactions } from '@reaction/interfaces/reaction.interface';

const log: Logger = config.createLogger('postCache');
const TRENDING_LIMIT = 200;

export type PostCacheMultiType = string | number | Buffer | RedisCommandRawReply[] | IPostDocument | IPostDocument[];

export class PostCache extends BaseCache {
  constructor() {
    super('postCache');
  }

  public async clearPersonalizedPostsCache(key: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const redisKey = `user:${key}:posts`;
      await this.client.del(redisKey);
    } catch (error) {
      log.error("Lỗi khi xóa cache", error, key);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async clearLastPersonalizedPostsCache(key: string, count: number = 50): Promise<void> {
  try {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
    const redisKey = `user:${key}:posts`;
    
    // Get the current length of the list
    const listLength = await this.client.lLen(redisKey);
    
    if (listLength <= count) {
      // If the list is shorter than or equal to count, clear it entirely
      await this.client.del(redisKey);
    } else {
      // Keep all elements except the last 'count' elements
      // In Redis, we can use negative indices (-1 is the last element)
      await this.client.lTrim(redisKey, 0, -count - 1);
    }
  } catch (error) {
    log.error("Lỗi khi xóa last cache", error, key);
    throw new ServerError('Server error. Try again.');
  }
}

  public async getAllPostsforUserFromCache(key: string): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      key = `user:${key}:posts`;
      const totalPosts = await this.client.lLen(key);
      const posts = await this.client.lRange(key, 0, totalPosts - 1);
      return posts.map(post => JSON.parse(post));
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  // public async getPostsforUserFromCache(key: string, skip: number, limit: number): Promise<IPostDocument[]> {
  //   try {
  //     if (!this.client.isOpen) {
  //       await this.client.connect();
  //     }
  //     const posts = await this.client.lRange(key, skip, skip + limit - 1);
  //     return posts.map(post => JSON.parse(post));
  //   } catch (error) {
  //     log.error(error);
  //     throw new ServerError('Server error. Try again.');
  //   }
  // }   

  public async getPostsforUserFromCache(key: string, skip: number, limit: number): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      // const keys = await this.client.keys('posts:*');
      // for (const key of keys) {
      //   const reactions = await this.client.hGet(key, 'reactions'); // Lấy trường "reactions"
      //   if (reactions) {
      //     const parsedReactions = JSON.parse(reactions);
  
      //     // Tính toán giá trị upvote và downvote
      //     const upvote = (parsedReactions.like || 0) +
      //                    (parsedReactions.love || 0) +
      //                    (parsedReactions.happy || 0) +
      //                    (parsedReactions.wow || 0);
      //     const downvote = (parsedReactions.sad || 0) +
      //                      (parsedReactions.angry || 0);
  
      //     // Cập nhật lại "reactions"
      //     const updatedReactions = {
      //       upvote: upvote,
      //       downvote: downvote,
      //     };
      //     await this.client.hSet(key, 'reactions', JSON.stringify(updatedReactions));
      //   }
      // }

      const postIdsWithScores = await this.client.lRange(key, skip, skip + limit - 1);
      const multi = this.client.multi();
      for (const postIdWithScore of postIdsWithScores) {
        const { _id } = JSON.parse(postIdWithScore);
        multi.HGETALL(`posts:${_id}`);
      }
      const replies: PostCacheMultiType = (await multi.exec()) as PostCacheMultiType;
      const postReplies: IPostDocument[] = [];
      for (const post of replies as IPostDocument[]) {
        // const isHidden = Helpers.parseJson(`${post.isHidden}`) as boolean;
        // if (isHidden) continue;
        if (post.isHidden === true) continue;
        
        post.commentsCount = Helpers.parseJson(`${post.commentsCount}`) as number;
        post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
        post.createdAt = new Date(Helpers.parseJson(`${post.createdAt}`)) as Date;
        postReplies.push(post);
      }

      return postReplies;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getQuestionsForUserFromCache(userId: string, skip: number, limit: number): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      const questionsKey = `user:${userId}:questions`;
      const totalQuestions = await this.client.lLen(questionsKey);
      
      if (totalQuestions === 0) {
        return [];
      }
      
      const questionIds = await this.client.lRange(questionsKey, skip, skip + limit - 1);
      
      if (questionIds.length === 0) {
        return [];
      }
      
      const multi = this.client.multi();
      for (const questionIdData of questionIds) {
        const { _id } = JSON.parse(questionIdData);
        multi.hGetAll(`posts:${_id}`);
      }
      
      const replies = await multi.exec();
      const questions: IPostDocument[] = [];
      
      for (const question of replies as unknown as IPostDocument[]) {
        if (question) {
          // Parse các trường cần thiết
          if (question.isHidden === true) continue;

          question.commentsCount = Helpers.parseJson(`${question.commentsCount}`) as number;
          question.reactions = Helpers.parseJson(`${question.reactions}`) as IReactions;
          question.createdAt = new Date(Helpers.parseJson(`${question.createdAt}`)) as Date;
          questions.push(question);
        }
      }
      
      return questions;
    } catch (error) {
      log.error("Lỗi khi lấy questions từ cache", error);
      throw new ServerError('Server error. Try again.');
    }
  }

  // public async updatePostforUserInCache(key: string, postId: string, updatedPost: IPostDocument): Promise<void> {
  //   try {
  //     if (!this.client.isOpen) {
  //       await this.client.connect();
  //     }
  //     const totalPosts = await this.client.lLen(key);
  //     for (let i = 0; i < totalPosts; i++) {
  //       const post = await this.client.lIndex(key, i);
  //       if (post) {
  //         const parsedPost = JSON.parse(post);
  //         if (parsedPost._id === postId) {
  //           await this.client.lSet(key, i, JSON.stringify(updatedPost));
  //           break;
  //         }
  //       }
  //     }
  //   } catch (error) {
  //     log.error(error);
  //     throw new ServerError('Server error. Try again.');
  //   }
  // }

  public async getTotalPostsforUser(key: string): Promise<number> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      return await this.client.lLen(key);
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getTotalQuestionsforUser(userId: string): Promise<number> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      const questionsKey = `user:${userId}:questions`;
      return await this.client.lLen(questionsKey);
    } catch (error) {
      log.error("Lỗi khi lấy tổng số questions cho user", error, userId);
      throw new ServerError('Server error. Try again.');
    }
  }

  // public async savePostsforUserToCache(key: string, posts: IPostDocument[]): Promise<void> {
  //   try {
  //     if (!this.client.isOpen) {
  //       await this.client.connect();
  //     }
  //     const serializedPosts = posts.map(post => JSON.stringify(post));
  //     await this.client.rPush(key, serializedPosts);
  //     await this.client.expire(key, 1800);
  //   } catch (error) {
  //     log.error("Lỗi ở đây", error, key, posts);
  //     throw new ServerError('Server error. Try again.');
  //   }
  // }

  public async saveQuestionsForUserToCache(userId: string, posts: { _id: string; score?: number; isQuestion?: boolean }[]): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const questionsKey = `user:${userId}:questions`;
      
      // Lọc ra chỉ những post là question
      const questions = posts.filter(post => post.isQuestion === true);
      
      if (questions.length > 0) {
        const serializedQuestions = questions.map(question => 
          JSON.stringify({ _id: question._id, score: question.score })
        );
        
        // Sử dụng rPush để thêm vào cuối danh sách, giữ thứ tự như posts
        await this.client.rPush(questionsKey, serializedQuestions);
        await this.client.expire(questionsKey, 1800); // TTL 30 phút
      }
    } catch (error) {
      log.error("Lỗi khi lưu questions vào cache", error, userId);
      throw new ServerError('Server error. Try again.');
    }
  }
  public async savePostsforUserToCache(key: string, posts: { _id: string, score?: number, isQuestion?: boolean }[]): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const serializedPosts = posts.map(post => JSON.stringify({ _id: post._id, score: post.score, isQuestion: post.isQuestion }));
      await this.client.rPush(key, serializedPosts);
      await this.client.expire(key, 1800); // Đặt TTL là 30 phút (1800 giây)
    } catch (error) {
      log.error("Lỗi ở đây", error, key, posts);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async savePostToCache(data: ISavePostToCache): Promise<void> {
    const { key, currentUserId, uId, createdPost } = data;
    const {
      _id,
      userId,
      username,
      email,
      avatarColor,
      profilePicture,
      post,
      htmlPost,
      bgColor,
      feelings,
      privacy,
      gifUrl,
      commentsCount,
      imgVersion,
      imgId,
      videoId,
      videoVersion,
      reactions,
      createdAt
    } = createdPost;

    const dataToSave = {
      '_id': `${_id}`,
      'userId': `${userId}`,
      'username': `${username}`,
      'email': `${email}`,
      'avatarColor': `${avatarColor}`,
      'profilePicture': `${profilePicture}`,
      'post': `${post}`,
      'htmlPost': `${htmlPost}`,
      'bgColor': `${bgColor}`,
      'feelings': `${feelings}`,
      'privacy': `${privacy}`,
      'gifUrl': `${gifUrl}`,
      'commentsCount': `${commentsCount}`,
      'reactions': JSON.stringify(reactions),
      'imgVersion': `${imgVersion}`,
      'imgId': `${imgId}`,
      'videoId': `${videoId}`,
      'videoVersion': `${videoVersion}`,
      'createdAt': `${createdAt}`
    };

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const postCount: string[] = await this.client.HMGET(`users:${currentUserId}`, 'postsCount');
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      await this.client.ZADD('post', { score: parseInt(uId, 10), value: `${key}` });
      for (const [itemKey, itemValue] of Object.entries(dataToSave)) {
        multi.HSET(`posts:${key}`, `${itemKey}`, `${itemValue}`);
      }
      const count: number = parseInt(postCount[0], 10) + 1;
      multi.HSET(`users:${currentUserId}`, 'postsCount', count);
      multi.exec();
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async addTrendingPost(postId: string, score: number): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // Thêm bài viết vào danh sách trending
      await this.client.zAdd('postTrending', { score, value: postId });

      // Giới hạn số lượng bài viết trending lưu trữ trong Redis
      const trendingCount = await this.client.zCard('postTrending');
      if (trendingCount > TRENDING_LIMIT) {
        await this.client.zRemRangeByRank('postTrending', 0, trendingCount - TRENDING_LIMIT - 1);
      }
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async updatePostScore(
    postId: string,
    addCmt: boolean = false,
    removeCmt: boolean = false,
    previousVote: string = 'upvote',
    vote: string = 'upvote',
    removeVote: boolean = false
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // Lấy score hiện tại của postId từ sorted set
      const currentScore = await this.client.zScore('postTrending', postId);
      if (currentScore === null) {
        log.error('Post not found in trending list.');
        return;
      }

      // Tính toán score mới dựa trên các hành động
      let scoreDelta = 0;
      if (addCmt) {
        scoreDelta = 10;
      } else if (removeCmt) {
        scoreDelta = -10;
      } else if (previousVote === 'upvote' && vote === 'downvote') {
        scoreDelta = -30;
      } else if (previousVote === 'downvote' && vote === 'upvote') {
        scoreDelta = 30;
      } else if (vote === 'upvote' && !removeVote) {
        scoreDelta = 15;
      } else if (vote === 'upvote' && removeVote) {
        scoreDelta = -15;
      } else if (vote === 'downvote' && !removeVote) {
        scoreDelta = -15;
      } else if (vote === 'downvote' && removeVote) {
        scoreDelta = 15;
      }

      const newScore = currentScore + scoreDelta;

      // Cập nhật score mới vào sorted set
      await this.client.zAdd('postTrending', { score: newScore, value: postId });

      // Giới hạn số lượng bài viết trending lưu trữ trong Redis
      const trendingCount = await this.client.zCard('postTrending');
      if (trendingCount > TRENDING_LIMIT) {
        await this.client.zRemRangeByRank('postTrending', 0, trendingCount - TRENDING_LIMIT - 1);
      }
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getPostFromCache(postId: string): Promise<IPostDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const postKey = `posts:${postId}`;
      const post: IPostDocument = (await this.client.HGETALL(postKey)) as unknown as IPostDocument;

      if (!post || Object.keys(post).length === 0) {
        return null;
      }

      post.commentsCount = Helpers.parseJson(`${post.commentsCount}`) as number;
      post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
      post.createdAt = new Date(Helpers.parseJson(`${post.createdAt}`)) as Date;

      return post;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getTrendingPosts(start: number, end: number): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const reply: string[] = await this.client.ZRANGE('postTrending', start, end, { REV: true });
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (const value of reply) {
        multi.HGETALL(`posts:${value}`);
      }
      const replies: PostCacheMultiType = (await multi.exec()) as PostCacheMultiType;
      const postReplies: IPostDocument[] = [];
      for (const post of replies as IPostDocument[]) {
        post.commentsCount = Helpers.parseJson(`${post.commentsCount}`) as number;
        post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
        post.createdAt = new Date(Helpers.parseJson(`${post.createdAt}`)) as Date;
        postReplies.push(post);
      }

      return postReplies;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getPostsFromCache(key: string, start: number, end: number): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const reply: string[] = await this.client.ZRANGE(key, start, end, { REV: true });
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (const value of reply) {
        multi.HGETALL(`posts:${value}`);
      }
      const replies: PostCacheMultiType = (await multi.exec()) as PostCacheMultiType;
      const postReplies: IPostDocument[] = [];
      for (const post of replies as IPostDocument[]) {
        post.commentsCount = Helpers.parseJson(`${post.commentsCount}`) as number;
        post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
        post.createdAt = new Date(Helpers.parseJson(`${post.createdAt}`)) as Date;
        postReplies.push(post);
      }

      return postReplies;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getTotalPostsInCache(): Promise<number> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const count: number = await this.client.ZCARD('post');
      return count;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getPostsWithImagesFromCache(key: string, start: number, end: number): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const reply: string[] = await this.client.ZRANGE(key, start, end, { REV: true });
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (const value of reply) {
        multi.HGETALL(`posts:${value}`);
      }
      const replies: PostCacheMultiType = (await multi.exec()) as PostCacheMultiType;
      const postWithImages: IPostDocument[] = [];
      for (const post of replies as IPostDocument[]) {
        if ((post.imgId && post.imgVersion) || post.gifUrl) {
          post.commentsCount = Helpers.parseJson(`${post.commentsCount}`) as number;
          post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
          post.createdAt = new Date(Helpers.parseJson(`${post.createdAt}`)) as Date;
          postWithImages.push(post);
        }
      }
      return postWithImages;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getPostsWithVideosFromCache(key: string, start: number, end: number): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const reply: string[] = await this.client.ZRANGE(key, start, end, { REV: true });
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (const value of reply) {
        multi.HGETALL(`posts:${value}`);
      }
      const replies: PostCacheMultiType = (await multi.exec()) as PostCacheMultiType;
      const postWithVideos: IPostDocument[] = [];
      for (const post of replies as IPostDocument[]) {
        if (post.videoId && post.videoVersion) {
          post.commentsCount = Helpers.parseJson(`${post.commentsCount}`) as number;
          post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
          post.createdAt = new Date(Helpers.parseJson(`${post.createdAt}`)) as Date;
          postWithVideos.push(post);
        }
      }
      return postWithVideos;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getUserPostsFromCache(key: string, uId: number): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const reply: string[] = await this.client.ZRANGE(key, uId, uId, { REV: true, BY: 'SCORE' });
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (const value of reply) {
        multi.HGETALL(`posts:${value}`);
      }
      const replies: PostCacheMultiType = (await multi.exec()) as PostCacheMultiType;
      const postReplies: IPostDocument[] = [];
      for (const post of replies as IPostDocument[]) {
        post.commentsCount = Helpers.parseJson(`${post.commentsCount}`) as number;
        post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
        post.createdAt = new Date(Helpers.parseJson(`${post.createdAt}`)) as Date;
        postReplies.push(post);
      }
      return postReplies;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getTotalUserPostsInCache(uId: number): Promise<number> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const count: number = await this.client.ZCOUNT('post', uId, uId);
      return count;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async deletePostFromCache(key: string, currentUserId: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const postCount: string[] = await this.client.HMGET(`users:${currentUserId}`, 'postsCount');
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      multi.ZREM('post', `${key}`);
      multi.DEL(`posts:${key}`);
      multi.DEL(`comments:${key}`);
      multi.DEL(`reactions:${key}`);
      const count: number = parseInt(postCount[0], 10) - 1;
      multi.HSET(`users:${currentUserId}`, 'postsCount', count);
      await multi.exec();
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async updatePostInCache(key: string, updatedPost: IPostDocument): Promise<IPostDocument> {
    const {
      htmlPost,
      post,
      bgColor,
      feelings,
      privacy,
      gifUrl,
      imgVersion,
      imgId,
      videoId,
      videoVersion,
      profilePicture,
      isHidden,
      hiddenReason,
      hiddenAt
    } = updatedPost;
    const dataToSave = {
      'htmlPost': `${htmlPost}`,
      'post': `${post}`,
      'bgColor': `${bgColor}`,
      'feelings': `${feelings}`,
      'privacy': `${privacy}`,
      'gifUrl': `${gifUrl}`,
      'videoId': `${videoId}`,
      'videoVersion': `${videoVersion}`,
      'profilePicture': `${profilePicture}`,
      'imgVersion': `${imgVersion}`,
      'imgId': `${imgId}`,
      'isHidden': `${isHidden}`,
    'hiddenReason': `${hiddenReason}`,
    'hiddenAt': hiddenAt ? new Date(hiddenAt).toISOString() : ''
    };

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      for (const [itemKey, itemValue] of Object.entries(dataToSave)) {
        console.log(itemKey, itemValue);
        if(itemValue != 'undefined') {
        await this.client.HSET(`posts:${key}`, `${itemKey}`, `${itemValue}`);}
      }
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      multi.HGETALL(`posts:${key}`);
      const reply: PostCacheMultiType = (await multi.exec()) as PostCacheMultiType;
      const postReply = reply as IPostDocument[];
      postReply[0].commentsCount = Helpers.parseJson(`${postReply[0].commentsCount}`) as number;
      postReply[0].reactions = Helpers.parseJson(`${postReply[0].reactions}`) as IReactions;
      postReply[0].createdAt = new Date(Helpers.parseJson(`${postReply[0].createdAt}`)) as Date;

      return postReply[0];
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async toggleFavoritePostInCache(userId: string, postId: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // Kiểm tra xem bài viết yêu thích đã tồn tại trong cache chưa
      const isFavorite = await this.client.ZSCORE(`favPosts:${userId}`, postId);
      if (isFavorite) {
        // Nếu đã tồn tại, xóa bài viết yêu thích khỏi cache
        await this.client.ZREM(`favPosts:${userId}`, postId);
      } else {
        // Nếu chưa tồn tại, thêm bài viết yêu thích vào cache
        await this.client.ZADD(`favPosts:${userId}`, { score: Date.now(), value: postId });
      }
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async toggleSavedByForPost(postId: string, userId: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const postKey = `posts:${postId}`;
      const savedBy: string[] = await this.client.HGET(postKey, 'savedBy').then(data => data ? JSON.parse(data) : []);
      const userIndex = savedBy.indexOf(userId);
      if (userIndex === -1) {
        // Nếu userId chưa có trong danh sách, thêm vào
        savedBy.push(userId);
      } else {
        // Nếu userId đã có, xóa khỏi danh sách
        savedBy.splice(userIndex, 1);
      }
      await this.client.HSET(postKey, 'savedBy', JSON.stringify(savedBy));
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async toggleReportPostInCache(userId: string, postId: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      // Kiểm tra xem bài viết yêu thích đã tồn tại trong cache chưa
      const isReport = await this.client.ZSCORE(`ReportPosts:${userId}`, postId);
      if (isReport) {
        // Nếu đã tồn tại, xóa bài viết yêu thích khỏi cache
        await this.client.ZREM(`ReportPosts:${userId}`, postId);
      } else {
        // Nếu chưa tồn tại, thêm bài viết yêu thích vào cache
        await this.client.ZADD(`ReportPosts:${userId}`, { score: Date.now(), value: postId });
      }
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getFavoritePostsFromCache(userId: string): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const postIds: string[] = await this.client.ZRANGE(`favPosts:${userId}`, 0, -1);
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (const postId of postIds) {
        multi.HGETALL(`posts:${postId}`);
      }
      const replies: PostCacheMultiType = (await multi.exec()) as PostCacheMultiType;
      const favoritePosts: IPostDocument[] = [];
      for (const post of replies as IPostDocument[]) {
        post.commentsCount = Helpers.parseJson(`${post.commentsCount}`) as number;
        post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
        post.createdAt = new Date(Helpers.parseJson(`${post.createdAt}`)) as Date;
        favoritePosts.push(post);
      }
      return favoritePosts;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async updatePostPropertyInCache(key: string, property: string, value: any): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      await this.client.HSET(`posts:${key}`, property, value);
    } catch (error) {
      console.error(error);
      throw new ServerError('Error updating post property in cache');
    }
  }
}
