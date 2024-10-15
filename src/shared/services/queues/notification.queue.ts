import { INotificationJobData } from '@notification/interfaces/notification.interface';
import { BaseQueue } from '@service/queues/base.queue';
import { notificationWorker } from '@worker/notification.worker';

class NotificationQueue extends BaseQueue {
  private static instance: NotificationQueue;
  constructor() {
    super('notifications');
    this.processJob('updateNotification', 5, notificationWorker.updateNotification);
    this.processJob('deleteNotification', 5, notificationWorker.deleteNotification);
  }

  public static getInstance(): NotificationQueue {
    if (!NotificationQueue.instance) {
      NotificationQueue.instance = new NotificationQueue();
    }
    return NotificationQueue.instance;
  }

  public addNotificationJob(name: string, data: INotificationJobData): void {
    this.addJob(name, data);
  }
}

export const notificationQueue: NotificationQueue = NotificationQueue.getInstance();
