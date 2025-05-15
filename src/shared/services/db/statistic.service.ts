import { ObjectId } from 'mongodb';
import { IGetPostsQuery, IPostDocument } from '@post/interfaces/post.interface';
import { ReportPostModel } from '@report-posts/models/report-post.schema';
import { IReportPostDocument } from '@report-posts/interfaces/report-post.interface';
import { PostModel } from '@post/models/post.schema';
import { UserModel } from '@user/models/user.schema';
import { postService } from './post.service';
import { AuthModel } from '@auth/models/auth.schema';
class StatisticService {
  public async countPostsPerDay(): Promise<any[]> {
    return PostModel.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalPosts: { $sum: 1 },
          hiddenPosts: {
            $sum: { $cond: ['$isHidden', 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  }

  public async countPostsMonth(): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); // Tính ngày cách đây 30 ngày

    return PostModel.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo } // Lọc bài đăng trong 30 ngày qua
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalPosts: { $sum: 1 },
          hiddenPosts: { $sum: { $cond: ['$isHidden', 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  }

  public async countPostsPerYear(): Promise<any[]> {
    const now = new Date();
    const months = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        yearMonth: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
        totalPosts: 0,
        hiddenPosts: 0
      });
    }

    const earliestDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const result = await PostModel.aggregate([
      {
        $match: {
          createdAt: { $gte: earliestDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' }
          },
          totalPosts: { $sum: 1 },
          hiddenPosts: {
            $sum: { $cond: ['$isHidden', 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    months.forEach((month) => {
      const foundMonth = result.find((r) => r._id === month.yearMonth);
      if (foundMonth) {
        month.totalPosts = foundMonth.totalPosts;
        month.hiddenPosts = foundMonth.hiddenPosts;
      }
    });

    return months;
  }

  public async countUsers(): Promise<any> {
    const totalUsers = await AuthModel.countDocuments();
    const bannedUsers = await AuthModel.countDocuments({ isBanned: true });

    return {
      totalUsers,
      bannedUsers
    };
  }

  public async countUsersMonth(): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return AuthModel.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalUsers: { $sum: 1 },
          bannedUsers: {
            $sum: { $cond: ['$isBanned', 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  }

  public async countUsersPerYear(): Promise<any[]> {
    const now = new Date();
    const months = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        yearMonth: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
        totalUsers: 0,
        bannedUsers: 0
      });
    }

    const earliestDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const result = await AuthModel.aggregate([
      {
        $match: {
          createdAt: { $gte: earliestDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' }
          },
          totalUsers: { $sum: 1 },
          bannedUsers: {
            $sum: { $cond: ['$isBanned', 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    months.forEach((month) => {
      const foundMonth = result.find((r) => r._id === month.yearMonth);
      if (foundMonth) {
        month.totalUsers = foundMonth.totalUsers;
        month.bannedUsers = foundMonth.bannedUsers;
      }
    });

    return months;
  }
}

export const statisticService: StatisticService = new StatisticService();
