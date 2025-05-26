import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
// import { UserCache } from '@service/redis/user.cache';
import { userQueue } from '@service/queues/user.queue';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { notificationSettingsSchema } from '@user/schemes/info';
import { cache } from '@service/redis/cache';
import { userService } from '@service/db/user.service';

// const userCache: UserCache = new UserCache();
const userCache = cache.userCache;
const postCache = cache.postCache;
const userBehaviorCache = cache.userBehaviorCache;

export class UpdateSettings {
  @joiValidation(notificationSettingsSchema)
  public async notification(req: Request, res: Response): Promise<void> {
    await userCache.updateSingleUserItemInCache(`${req.currentUser!.userId}`, 'notifications', req.body);
    userQueue.addUserJob('updateNotificationSettings', {
      key: `${req.currentUser!.userId}`,
      value: req.body
    });
    res.status(HTTP_STATUS.OK).json({ message: 'Notification settings updated successfully', settings: req.body });
  }
  public async personalizeSettings(req: Request, res: Response): Promise<void> {
    await postCache.clearPersonalizedPostsCache(`${req.currentUser!.userId}`);
    await userCache.updateSingleUserItemInCache(`${req.currentUser!.userId}`, 'personalizeSettings', req.body);
    await userService.updatePersonalizeSettings(`${req.currentUser!.userId}`, req.body);
    res.status(HTTP_STATUS.OK).json({ message: 'Personalize settings updated successfully', settings: req.body });
  }

  public async clearAllPersonalized (req: Request, res: Response): Promise<void> {
    await postCache.clearPersonalizedPostsCache(`${req.currentUser!.userId}`);
    await userBehaviorCache.clearUserInterests(`${req.currentUser!.userId}`);
    await userService.clearAllPersonalized(`${req.currentUser!.userId}`);
    res.status(HTTP_STATUS.OK).json({ message: 'Personalize settings cleared successfully' });
  }

  public async clearUserBehaviorPersonalized (req: Request, res: Response): Promise<void> {
    await postCache.clearPersonalizedPostsCache(`${req.currentUser!.userId}`);
    await userBehaviorCache.clearUserInterests(`${req.currentUser!.userId}`);
    await userService.clearUserVector(`${req.currentUser!.userId}`);
    res.status(HTTP_STATUS.OK).json({ message: 'User behavior cleared successfully' });
  }
}
