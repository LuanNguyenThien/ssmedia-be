import { Request, Response } from 'express';
// import { UserCache } from '@service/redis/user.cache';
import { IUserDocument } from '@user/interfaces/user.interface';
import { userService } from '@service/db/user.service';
import HTTP_STATUS from 'http-status-codes';
import { cache } from '@service/redis/cache';

// const userCache: UserCache = new UserCache();
const userCache = cache.userCache;

export class CurrentUser {
  public async read(req: Request, res: Response): Promise<void> {
    let isUser = false;
    let token = null;
    let user = null;
    // const cachedUser: IUserDocument = (await userCache.getUserFromCache(`${req.currentUser!.userId}`)) as IUserDocument;
    // const existingUser: IUserDocument = cachedUser ? cachedUser : await userService.getUserById(`${req.currentUser!.userId}`);
    const existingUser: IUserDocument = await userService.getUserById(`${req.currentUser!.userId}`);
    if (Object.keys(existingUser).length) {
      isUser = true;
      token = req.session?.jwt;
      user = existingUser;
    }
    res.status(HTTP_STATUS.OK).json({ token, isUser, user });
  }
  public async update(req: Request, res: Response): Promise<void> {
    const { uId, username, email } = req.body;
    await userService.updateProfile(uId, username, email);
    res.status(HTTP_STATUS.OK).json({ message: 'User have updated' });
  }
}
