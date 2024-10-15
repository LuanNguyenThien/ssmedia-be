import { ICommentJob } from '@comment/interfaces/comment.interface';
import { BaseQueue } from '@service/queues/base.queue';
import { commentWorker } from '@worker/comment.worker';

class CommentQueue extends BaseQueue {
  private static instance: CommentQueue;
  constructor() {
    super('comments');
    this.processJob('addCommentToDB', 5, commentWorker.addCommentToDB);
  }

  public static getInstance(): CommentQueue {
    if (!CommentQueue.instance) {
      CommentQueue.instance = new CommentQueue();
    }
    return CommentQueue.instance;
  }

  public addCommentJob(name: string, data: ICommentJob): void {
    this.addJob(name, data);
  }
}

export const commentQueue: CommentQueue = CommentQueue.getInstance();
