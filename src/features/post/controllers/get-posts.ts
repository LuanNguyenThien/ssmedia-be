import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { IPostDocument } from '@post/interfaces/post.interface';
// import { PostCache } from '@service/redis/post.cache';
import { postService } from '@service/db/post.service';
import { cache } from '@service/redis/cache';

// const postCache: PostCache = new PostCache();
const postCache = cache.postCache;
const PAGE_SIZE = 10;
const REDIS_BATCH_SIZE = 50;

export class Get {

  public async postById(req: Request, res: Response): Promise<Response> {
    const { postId } = req.params;
    let post: IPostDocument | null = await postCache.getPostFromCache(postId);
    if (!post) {
      post = await postService.getPostById(postId);
      if (!post) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Post not found' });
      }
    }
    return res.status(HTTP_STATUS.OK).json({ message: 'Post found', post });
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
  public async posts(req: Request, res: Response): Promise<void> {
    const { page } = req.params;
    const userId = req.currentUser!.userId;
    const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
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
        const formattedPosts = newPosts
          .map(post => ({ _id: post._id!.toString(), score: post.score as number }));
        await postCache.savePostsforUserToCache(redisKey, formattedPosts);

        posts = await postCache.getPostsforUserFromCache(redisKey, skip, limit);
        totalPosts = await postService.postsCount();
      }
    }
    res.status(HTTP_STATUS.OK).json({ message: 'All posts', posts, totalPosts });
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
