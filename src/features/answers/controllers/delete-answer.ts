import { Request, Response } from 'express';
// import { PostCache } from '@service/redis/post.cache';
import HTTP_STATUS from 'http-status-codes';
import { postService } from '@service/db/post.service';
import { socketIOPostObject } from '@socket/post';
import { cache } from '@service/redis/cache';

// const postCache: PostCache = new PostCache();
const postCache = cache.postCache;

export class DeleteAnswer {
  public async answer(req: Request, res: Response): Promise<void> {
    const { answerId } = req.params;
    const { questionId } = req.query;

    socketIOPostObject.emit('delete post', answerId);
    await postCache.deleteAnswerFromCache(answerId, questionId as string);
    postService.deleteAnswer(answerId, questionId as string);
    res.status(HTTP_STATUS.OK).json({ message: 'Answer deleted successfully' });
  }
}