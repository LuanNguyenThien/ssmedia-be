import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { FollowerCache } from '@service/redis/follower.cache';
// import { PostCache } from '@service/redis/post.cache';
// import { UserCache } from '@service/redis/user.cache';
import { IAllUsers, IUserDocument } from '@user/interfaces/user.interface';
import { userService } from '@service/db/user.service';

const PAGE_SIZE = 5;
export class getUser {
  public async getAllUsers(req: Request, res: Response): Promise<void> {
    const { page } = req.params;
    const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
    const users: IUserDocument[] = await userService.getAllUsers(req.currentUser!.userId, skip, PAGE_SIZE);
    const totalUsers: number = await userService.getTotalUsersInDB();

    res.status(HTTP_STATUS.OK).json({
      message: 'Get all users',
      users,
      totalUsers,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalUsers / PAGE_SIZE)
    });
  }

  public async getByUserId(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    // const cachedUser: IUserDocument = (await userCache.getUserFromCache(userId)) as IUserDocument;
    const existingUser: IUserDocument = await userService.getUserById(userId);
    res.status(HTTP_STATUS.OK).json({ message: 'Get user detail', user: existingUser });
  }
}
