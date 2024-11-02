import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { favPostService } from '@service/db/fav-post.service';
import { cache } from '@service/redis/cache';
import { IPostDocument } from '@post/interfaces/post.interface';

const postCache = cache.postCache;
const PAGE_SIZE = 10;

export class Get {
  public async favoritePosts(req: Request, res: Response): Promise<void> {
    try {
      const { page } = req.params;
      const userId = req.currentUser!.userId;
      const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
      const limit: number = PAGE_SIZE;
      const newSkip: number = skip === 0 ? skip : skip + 1;
      let favposts: IPostDocument[] = [];

      const cachedPosts: IPostDocument[] = await postCache.getFavoritePostsFromCache(userId);
      if (cachedPosts.length) {
        favposts = cachedPosts;
      } else {
        favposts = await favPostService.getFavoritePosts(userId, skip, limit);
      }

      res.status(HTTP_STATUS.OK).json({ message: 'All favorite posts', favposts });
    } catch (error) {
      console.error('Error getting posts:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error getting posts' });
    }
  }
}
