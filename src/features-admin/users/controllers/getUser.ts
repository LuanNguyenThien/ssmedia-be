import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { FollowerCache } from '@service/redis/follower.cache';
// import { PostCache } from '@service/redis/post.cache';
// import { UserCache } from '@service/redis/user.cache';
import { IAllUsers, IUserDocument } from '@user/interfaces/user.interface';
import { userService } from '@service/db/user.service';
import { userBanService } from '@service/db/ban-user.service';

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

  public async getBannedUsers(req: Request, res: Response): Promise<void> {
    try {
      const { page } = req.params;
      const skip: number = (parseInt(page) - 1) * PAGE_SIZE;

      // Gọi service và destructure kết quả
      const { results: bannedUsers, total } = await userBanService.getBannedUsers(req.currentUser!.userId, skip, PAGE_SIZE);

      // Nếu không có user nào bị ban
      if (bannedUsers.length === 0) {
        res.status(HTTP_STATUS.OK).json({
          message: 'No banned users found',
          data: [],
          total: 0
        });
        return; // Đừng quên return
      }

      // Trả về danh sách và tổng số lượng
      res.status(HTTP_STATUS.OK).json({
        message: 'Banned users retrieved successfully',
        data: bannedUsers,
        total
      });
    } catch (error) {
      console.error('Error fetching banned users:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Failed to retrieve banned users' });
    }
  }

  public async getUsersFromAppeals(req: Request, res: Response): Promise<void> {
    try {
      const pageParam = req.params.page;
      const page = pageParam && !isNaN(+pageParam) && +pageParam > 0 ? parseInt(pageParam) : 1;
      if (page < 1 || isNaN(page)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Invalid page number' });
        return;
      }

      const skip: number = (page - 1) * PAGE_SIZE;
      const usersFromAppeals = await userBanService.getUsersFromAppeals(skip, PAGE_SIZE);
      const totalUsers = await userBanService.countUsersFromAppeals();

      if (usersFromAppeals.length === 0) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'No users found in appeals' });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        message: 'Users retrieved from appeals successfully',
        data: usersFromAppeals,
        currentCount: usersFromAppeals.length,
        pagination: {
          currentPage: page,
          totalUsers,
          totalPages: Math.ceil(totalUsers / PAGE_SIZE)
        }
      });
    } catch (error) {
      console.error('Error fetching users from appeals:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Failed to retrieve users from appeals' });
    }
  }

  public async getNewUsersToday(req: Request, res: Response): Promise<void> {
    try {
      const count = await userService.countNewUsersToday();
      res.status(HTTP_STATUS.OK).json({
        message: 'Successfully retrieved the count of new users today',
        count
      });
    } catch (error) {
      console.error('Error retrieving the count of new users today:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: 'Server error while retrieving the count of new users today'
      });
    }
  }
}
