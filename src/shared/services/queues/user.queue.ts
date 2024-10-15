import { BaseQueue } from '@service/queues/base.queue';
import { IUserJob } from '@user/interfaces/user.interface';
import { userWorker } from '@worker/user.worker';

class UserQueue extends BaseQueue {
  private static instance: UserQueue;
  constructor() {
    super('user');
    this.processJob('addUserToDB', 5, userWorker.addUserToDB);
    this.processJob('updateSocialLinksInDB', 5, userWorker.updateSocialLinks);
    this.processJob('updateBasicInfoInDB', 5, userWorker.updateUserInfo);
    this.processJob('updateNotificationSettings', 5, userWorker.updateNotificationSettings);
  }

  public static getInstance(): UserQueue {
    if (!UserQueue.instance) {
      UserQueue.instance = new UserQueue();
    }
    return UserQueue.instance;  
  }

  public addUserJob(name: string, data: IUserJob): void {
    this.addJob(name, data);
  }
}

export const userQueue: UserQueue = UserQueue.getInstance();
