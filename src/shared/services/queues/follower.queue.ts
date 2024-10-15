import { IFollowerJobData } from '@follower/interfaces/follower.interface';
import { BaseQueue } from '@service/queues/base.queue';
import { followerWorker } from '@worker/follower.worker';

class FollowerQueue extends BaseQueue {
  private static instance: FollowerQueue;
  constructor() {
    super('followers');
    this.processJob('addFollowerToDB', 5, followerWorker.addFollowerToDB);
    this.processJob('removeFollowerFromDB', 5, followerWorker.removeFollowerFromDB);
  }

  public static getInstance(): FollowerQueue {
    if (!FollowerQueue.instance) {
      FollowerQueue.instance = new FollowerQueue();
    }
    return FollowerQueue.instance;
  }

  public addFollowerJob(name: string, data: IFollowerJobData): void {
    this.addJob(name, data);
  }
}

export const followerQueue: FollowerQueue = FollowerQueue.getInstance();
