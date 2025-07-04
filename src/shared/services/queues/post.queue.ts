import { IPostJobData } from '@post/interfaces/post.interface';
import { BaseQueue } from '@service/queues/base.queue';
import { postWorker } from '@worker/post.worker';
import { Job } from 'bull';

class PostQueue extends BaseQueue {
  private static instance: PostQueue;
  constructor() {
    super('posts');
    this.processJob('addPostToDB', 5, postWorker.savePostToDB);
    this.processJob('deletePostFromDB', 5, postWorker.deletePostFromDB);
    this.processJob('updatePostInDB', 5, postWorker.updatePostInDB);
    this.processJob('analyzePostContent', 5, postWorker.analyzePostContent);
  }

  public static getInstance(): PostQueue {
    if (!PostQueue.instance) {
      PostQueue.instance = new PostQueue();
    }
    return PostQueue.instance;
  }

  public addPostJob(name: string, data: IPostJobData): Promise<Job> {
    return this.addJob(name, data);
  }
}

export const postQueue: PostQueue = PostQueue.getInstance();
