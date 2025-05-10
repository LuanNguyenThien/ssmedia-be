import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { postService } from '@service/db/post.service';
import { reportPostService } from '@service/db/report-post.service';
import { BadRequestError } from '@global/helpers/error-handler';
import { socketIOPostObject } from '@socket/post';
import { cache } from '@service/redis/cache';
import {  IPostDocument } from '@post/interfaces/post.interface';
import { PostModel } from '@post/models/post.schema';
// const postCache: PostCache = new PostCache();
const postCache = cache.postCache;
export class Add {
  public async hidePost(req: Request, res: Response): Promise<void> {
    try {
      const { postId, reason } = req.body;
      
      const updatedPost: Partial<IPostDocument> = {
        isHidden: true,
        hiddenReason: reason,
        hiddenAt: new Date()
      };

      // Cập nhật cache với type assertion
      const postUpdated = await postCache.updatePostInCache(postId, updatedPost as IPostDocument);
      await postService.hidePost(postId, reason);
      socketIOPostObject.emit('hide post', { postId, reason }); 
      res.status(HTTP_STATUS.OK).json({ message: 'Post hidden successfully' });
    } catch (error) {
      console.error('Error hiding post:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error hiding post' });
    }
  }

  public async unhidePost(req: Request, res: Response): Promise<Response> {
    try {
      const { postId } = req.body;

      if (!postId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Missing postId parameter' });
      }

      const updatedPost: Partial<IPostDocument> = {
        isHidden: false,
        
      };

      // Cập nhật cache với type assertion
      const postUpdated = await postCache.updatePostInCache(postId, updatedPost as IPostDocument);
      

      const post = await postService.getPostById(postId);
      if (!post) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Post not found' });
      }

      await postService.unhidePost(postId);
      socketIOPostObject.emit('unhide post', { postId });
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

  public async updateReportPostStatus(req: Request, res: Response): Promise<void> {
    const { reportId, status } = req.body;

    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      throw new BadRequestError('Invalid status value');
    }

    const updatedReport = await reportPostService.updateReportPostStatus(reportId, status);

    if (!updatedReport) {
      throw new BadRequestError('Report not found');
    }

    res.status(HTTP_STATUS.OK).json({
      message: 'Report post status updated successfully',
      updatedReport
    });
  }
}
