import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import HTTP_STATUS from 'http-status-codes';
import { ReportPostsSchema } from '@report-posts/schemas/report-post';
import { IPostDocument } from '@post/interfaces/post.interface';
import { BadRequestError } from '@global/helpers/error-handler';
import { reportPostQueue } from '@service/queues/reportpost.queue';
import { cache } from '@service/redis/cache';
import { IReportPostDocument } from '@report-posts/interfaces/report-post.interface';

const postCache = cache.postCache;

export class Add {
  @joiValidation(ReportPostsSchema)
  public async reportPost(req: Request, res: Response): Promise<void> {
    const { postId, content } = req.body;
    const userId = req.currentUser!.userId;
    const reportPostObjectId: ObjectId = new ObjectId();

    const reportPost: IReportPostDocument = {
      _id: reportPostObjectId,
      userId,
      postId,
      content,
      createdAt: new Date()
    } as IReportPostDocument;

    await postCache.toggleReportPostInCache(userId, postId);
    reportPostQueue.addReportPostJob('addreportPostToDB', reportPost);

    res.status(HTTP_STATUS.CREATED).json({ message: 'Report post successfully' });
  }
}
