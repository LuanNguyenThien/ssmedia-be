import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
// import { UserCache } from '@service/redis/user.cache';
import { userQueue } from '@service/queues/user.queue';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { basicInfoSchema, socialLinksSchema } from '@user/schemes/info';
import { cache } from '@service/redis/cache';
import { UserModel } from '@user/models/user.schema';

// const userCache: UserCache = new UserCache();
const userCache = cache.userCache;

export class Edit {
  public async personalHobby(req: Request, res: Response): Promise<void> {
    // await userCache.updateSingleUserItemInCache(`${req.currentUser!.userId}`, 'personalHobby', req.body);
    // userQueue.addUserJob('updatePersonalHobbyInDB', {
    //   key: `${req.currentUser!.userId}`,
    //   value: req.body
    // });
    await UserModel.updateOne(
      { _id: `${req.currentUser!.userId}` },
      {
        $set: {
          user_hobbies: {
            subject: `${req.body.subject}`
          }
        }
      }
    ).exec();
    res.status(HTTP_STATUS.OK).json({ message: 'Updated successfully' });
  }
  @joiValidation(basicInfoSchema)
  public async info(req: Request, res: Response): Promise<void> {
    for (const [key, value] of Object.entries(req.body)) {
      await userCache.updateSingleUserItemInCache(`${req.currentUser!.userId}`, key, `${value}`);
    }
    userQueue.addUserJob('updateBasicInfoInDB', {
      key: `${req.currentUser!.userId}`,
      value: req.body
    });
    res.status(HTTP_STATUS.OK).json({ message: 'Updated successfully' });
  }

  @joiValidation(socialLinksSchema)
  public async social(req: Request, res: Response): Promise<void> {
    await userCache.updateSingleUserItemInCache(`${req.currentUser!.userId}`, 'social', req.body);
    userQueue.addUserJob('updateSocialLinksInDB', {
      key: `${req.currentUser!.userId}`,
      value: req.body
    });
    res.status(HTTP_STATUS.OK).json({ message: 'Updated successfully' });
  }

  

}
