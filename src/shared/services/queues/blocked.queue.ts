import { IBlockedUserJobData } from '@follower/interfaces/follower.interface';
import { BaseQueue } from '@service/queues/base.queue';
import { blockedUserWorker } from '@worker/blocked.worker';

class BlockedUserQueue extends BaseQueue {
  private static instance: BlockedUserQueue;
  constructor() {
    super('blockedUsers');
    this.processJob('addBlockedUserToDB', 5, blockedUserWorker.addBlockedUserToDB);
    this.processJob('removeBlockedUserFromDB', 5, blockedUserWorker.addBlockedUserToDB);
  }

  public static getInstance(): BlockedUserQueue {
    if (!BlockedUserQueue.instance) {
        BlockedUserQueue.instance = new BlockedUserQueue();
    }
    return BlockedUserQueue.instance;
  }

  public addBlockedUserJob(name: string, data: IBlockedUserJobData): void {
    this.addJob(name, data);
  }
}

export const blockedUserQueue: BlockedUserQueue = BlockedUserQueue.getInstance();
