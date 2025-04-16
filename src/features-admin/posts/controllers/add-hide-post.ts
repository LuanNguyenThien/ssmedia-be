import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { postService } from '@service/db/post.service';

export class Add {
  public async hidePost(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;

      await postService.hidePost(postId);

      res.status(HTTP_STATUS.OK).json({ message: 'Post hidden successfully' });
    } catch (error) {
      console.error('Error hiding post:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error hiding post' });
    }
  }

  public async unhidePost(req: Request, res: Response): Promise<Response> {
    try {
      const { postId } = req.params;

      if (!postId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Missing postId parameter' });
      }

      const post = await postService.getPostById(postId);
      if (!post) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Post not found' });
      }

      await postService.unhidePost(postId);

      return res.status(HTTP_STATUS.OK).json({ message: 'Post unhidden successfully' });
    } catch (error) {
      console.error('Error unhiding post:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error unhiding post' });
    }
  }

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
}
