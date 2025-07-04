import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { IPostDocument } from '@post/interfaces/post.interface';
// import { PostCache } from '@service/redis/post.cache';
import { postService } from '@service/db/post.service';
import { cache } from '@service/redis/cache';
import { existingUser } from '@root/mocks/user.mock';
import mongoose from 'mongoose';

// const postCache: PostCache = new PostCache();
const postCache = cache.postCache;
const PAGE_SIZE = 10;
const REDIS_BATCH_SIZE = 50;

export class Get {
  public async postById(req: Request, res: Response): Promise<Response> {
    const { postId } = req.params;
    // let post: IPostDocument | null = await postCache.getPostFromCache(postId);
    // if (!post) {
      
    // }
    let post: IPostDocument | null = await postService.getPostById(postId);
    if (!post) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Post not found' });
    }
    return res.status(HTTP_STATUS.OK).json({ message: 'Post found', post });
  }

  public async postByUserIdPaginated(req: Request, res: Response): Promise<void> {
    const { userId, page } = req.params;
    const skip: number = (parseInt(page, 10) - 1) * PAGE_SIZE;
    const limit: number = PAGE_SIZE * parseInt(page, 10);
    const objectId = new mongoose.Types.ObjectId(userId);

    console.log(userId, page);
    const userPosts: IPostDocument[] = await postService.getPosts({ userId: objectId }, skip, limit, { createdAt: -1 });
    console.log(userPosts);
    res.status(HTTP_STATUS.OK).json({ message: 'User posts', posts: userPosts });
  }

  // public async posts(req: Request, res: Response): Promise<void> {
  //   const { page } = req.params;
  //   const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
  //   const limit: number = PAGE_SIZE * parseInt(page);
  //   const newSkip: number = skip === 0 ? skip : skip + 1;
  //   let posts: IPostDocument[] = [];
  //   let totalPosts = 0;
  //   const cachedPosts: IPostDocument[] = await postCache.getPostsFromCache('post', skip, limit-1);
  //   if (cachedPosts.length) {
  //     posts = cachedPosts;
  //     totalPosts = await postCache.getTotalPostsInCache();
  //   } else {
  //     posts = await postService.getPosts({}, skip, limit, { createdAt: -1 });
  //     totalPosts = await postService.postsCount();
  //   }
  //   res.status(HTTP_STATUS.OK).json({ message: 'All posts', posts, totalPosts });
  // }

  // public async posts(req: Request, res: Response): Promise<void> {
  //   try {
  //     console.time('posts');
  //     const { page } = req.params;
  //     const userId = req.currentUser!.userId;
  //     const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
  //     const limit: number = PAGE_SIZE;

  //     // // Direct database query approach for reliability
  //     // const posts = await postService.getPostsforUserByVector(userId, skip, limit);
  //     // const totalPosts = await postService.postsCount();

  //     let posts: IPostDocument[] = [];
  //     let totalPosts = 0;
  //     const cachePosts = await postCache.getPostsforUserFromCache(userId, skip, limit);

  //     if (cachePosts.length) {
  //       posts = cachePosts;
  //       totalPosts = await postCache.getTotalPostsforUser(userId);
  //       console.log('Cache hit');
  //     } else {
  //       posts = await postService.getPostsforUserByVector(userId, skip, limit);
  //       totalPosts = await postService.postsCount();
  //       await postCache.savePostsforUserToCache(
  //         userId,
  //         posts.map(post => ({
  //           _id: post._id?.toString() || '',
  //           score: post?.score || 0
  //         }))
  //       );
  //       console.log('Cache miss');
  //     }
  //     console.timeEnd('posts');

  //     res.status(HTTP_STATUS.OK).json({
  //       message: 'All posts',
  //       posts,
  //       totalPosts
  //     });
  //   } catch (error) {
  //     console.error('Error fetching posts:', error);
  //     res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
  //       message: 'Error fetching posts',
  //       error: (error as Error).message
  //     });
  //   }
  // }

  public async posts(req: Request, res: Response): Promise<void> {
    try {
      console.time('posts');
      const { page } = req.params;
      const userId = req.currentUser!.userId;
      let skip: number = (parseInt(page) - 1) * PAGE_SIZE;
      const limit: number = PAGE_SIZE;
      let posts: IPostDocument[] = [];
      let totalPosts = 0;

      // Tạo khóa Redis duy nhất cho mỗi người dùng
      const redisKey = `user:${userId}:posts`;
      // Lấy bài viết từ Redis
      const cachedPosts: IPostDocument[] = await postCache.getPostsforUserFromCache(redisKey, skip, limit);
      if (cachedPosts.length === limit) {
        posts = cachedPosts;
        totalPosts = await postService.postsCount();
      } else {
        // Lấy thêm bài viết từ MongoDB
        const redisCount = await postCache.getTotalPostsforUser(redisKey);
        const mongoSkip = redisCount;
        const mongoLimit = REDIS_BATCH_SIZE;
        const newPosts = await postService.getPostsforUserByVector(userId, mongoSkip, mongoLimit);

        if (newPosts.length === 0) {
          posts = await postCache.getPostsforUserFromCache(redisKey, skip, limit);
          totalPosts = redisCount;
        } else {
          const formattedPosts = newPosts.map((post) => ({
            _id: post._id as string,
            score: post.score as number,
            isQuestion: (post.htmlPost as string) === '' || post.htmlPost === undefined
          }));
          console.log(formattedPosts);
          await postCache.savePostsforUserToCache(redisKey, formattedPosts);
          await postCache.saveQuestionsForUserToCache(userId, formattedPosts);
          if (redisCount === 0) {
            skip = 0;
          }

          posts = await postCache.getPostsforUserFromCache(redisKey, skip, limit);
          totalPosts = await postService.postsCount();
        }
      }
      console.timeEnd('posts');
      res.status(HTTP_STATUS.OK).json({ message: 'All posts', posts, totalPosts });
    } catch (error) {
      console.error('Error fetching posts:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: 'Error fetching posts',
        error: (error as Error).message
      });
    }
  }

  public async questions(req: Request, res: Response): Promise<void> {
    try {
      const { page } = req.params;
      const userId = req.currentUser!.userId;
      let skip: number = (parseInt(page) - 1) * PAGE_SIZE;
      const limit: number = PAGE_SIZE * parseInt(page);
      const newSkip: number = skip === 0 ? skip : skip + 1;
      let questions: IPostDocument[] = [];
      let totalQuestions = 0;
      const redisKey = `user:${userId}:posts`;
      const cachedQuestions: IPostDocument[] = await postCache.getQuestionsForUserFromCache(userId, newSkip, limit);
      if (cachedQuestions.length === limit) {
        questions = cachedQuestions;
        totalQuestions = await postCache.getTotalQuestionsforUser(userId);
      } else {
        // Lấy thêm bài viết từ MongoDB
        const redisCount = await postCache.getTotalPostsforUser(redisKey);
        const mongoSkip = redisCount;
        const mongoLimit = REDIS_BATCH_SIZE;
        const newPosts = await postService.getPostsforUserByVector(userId, mongoSkip, mongoLimit);

        if (newPosts.length === 0) {
          questions = await postCache.getQuestionsForUserFromCache(userId, skip, limit);
          totalQuestions = await postCache.getTotalQuestionsforUser(userId);
        } else {
          const formattedPosts = newPosts.map((post) => ({
            _id: post._id as string,
            score: post.score as number,
            isQuestion: (post.htmlPost as string) === '' || post.htmlPost === undefined
          }));
          console.log(formattedPosts);
          await postCache.savePostsforUserToCache(redisKey, formattedPosts);
          await postCache.saveQuestionsForUserToCache(userId, formattedPosts);
          if (redisCount === 0) {
            skip = 0;
          }

          questions = await postCache.getQuestionsForUserFromCache(userId, skip, limit);
          totalQuestions = await postService.postsCount();
        }
      }
      res.status(HTTP_STATUS.OK).json({ message: 'All posts', questions, totalQuestions });
    } catch (error) {
      console.error('Error fetching posts:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: 'Error fetching posts',
        error: (error as Error).message
      });
    }
  }

  public async postsWithImages(req: Request, res: Response): Promise<void> {
    const { page } = req.params;
    const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
    const limit: number = PAGE_SIZE * parseInt(page);
    const newSkip: number = skip === 0 ? skip : skip + 1;
    let posts: IPostDocument[] = [];
    const cachedPosts: IPostDocument[] = await postCache.getPostsWithImagesFromCache('post', newSkip, limit);
    posts = cachedPosts.length ? cachedPosts : await postService.getPosts({ imgId: '$ne', gifUrl: '$ne' }, skip, limit, { createdAt: -1 });
    res.status(HTTP_STATUS.OK).json({ message: 'All posts with images', posts });
  }

  public async postsWithVideos(req: Request, res: Response): Promise<void> {
    const { page } = req.params;
    const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
    const limit: number = PAGE_SIZE * parseInt(page);
    const newSkip: number = skip === 0 ? skip : skip + 1;
    let posts: IPostDocument[] = [];
    const cachedPosts: IPostDocument[] = await postCache.getPostsWithVideosFromCache('post', newSkip, limit);
    posts = cachedPosts.length ? cachedPosts : await postService.getPosts({ videoId: '$ne' }, skip, limit, { createdAt: -1 });
    res.status(HTTP_STATUS.OK).json({ message: 'All posts with videos', posts });
  }
}
