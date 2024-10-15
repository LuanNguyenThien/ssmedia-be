import { IAuthJob } from '@auth/interfaces/auth.interface';
import { BaseQueue } from '@service/queues/base.queue';
import { authWorker } from '@worker/auth.worker';

class AuthQueue extends BaseQueue {
  private static instance: AuthQueue;
  constructor() {
    super('auth');
    this.processJob('addAuthUserToDB', 5, authWorker.addAuthUserToDB);
  }

  public static getInstance(): AuthQueue {
    if (!AuthQueue.instance) {
        AuthQueue.instance = new AuthQueue();
    }
    return AuthQueue.instance;
  }

  public addAuthUserJob(name: string, data: IAuthJob): void {
    this.addJob(name, data);
  }
}

export const authQueue: AuthQueue = AuthQueue.getInstance();
