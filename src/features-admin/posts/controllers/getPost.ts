import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { postService } from '@service/db/post.service';

export class Get {
  public async getHiddenPosts(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.params.page) || 1;
      const PAGE_SIZE = 10;
      const skip = (page - 1) * PAGE_SIZE;

      const hiddenPosts = await postService.getHiddenPosts(skip, PAGE_SIZE);

      res.status(HTTP_STATUS.OK).json({
        message: 'List of hidden posts',
        hiddenPosts
      });
    } catch (error) {
      console.error('Error getting hidden posts:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error getting hidden posts' });
    }
  }

  public async getPostStats(req: Request, res: Response): Promise<void> {
    try {
      const totalPosts = await postService.postsCount();
      const postsToday = await postService.countPostsToday();

      res.status(HTTP_STATUS.OK).json({
        message: 'Successfully retrieved post statistics',
        totalPosts,
        postsToday
      });
    } catch (error) {
      console.error('Error retrieving post statistics:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: 'Server error while retrieving post statistics'
      });
    }
  }
}
