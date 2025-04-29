import { IBasicInfo, ISearchUser, IUserDocument, ISocialLinks, INotificationSettings } from '@user/interfaces/user.interface';
import { UserModel } from '@user/models/user.schema';
import mongoose from 'mongoose';
import { indexOf } from 'lodash';
import { followerService } from '@service/db/follower.service';
import { AuthModel } from '@auth/models/auth.schema';

class UserService {
  public async addUserData(data: IUserDocument): Promise<void> {
    await UserModel.create(data);
  }

  public async updatePassword(username: string, hashedPassword: string): Promise<void> {
    await AuthModel.updateOne({ username }, { $set: { password: hashedPassword } }).exec();
  }

  public async countNewUsersToday(): Promise<number> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const count = await AuthModel.countDocuments({
      createdAt: { $gte: startOfToday, $lte: endOfToday }
    });

    return count;
  }

  public async updateUserInfo(userId: string, info: IBasicInfo): Promise<void> {
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          work: info['work'],
          school: info['school'],
          quote: info['quote'],
          location: info['location']
        }
      }
    ).exec();
  }

  public async updateSocialLinks(userId: string, links: ISocialLinks): Promise<void> {
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: { social: links }
      }
    ).exec();
  }

  public async updateNotificationSettings(userId: string, settings: INotificationSettings): Promise<void> {
    await UserModel.updateOne({ _id: userId }, { $set: { notifications: settings } }).exec();
  }

  public async getUserById(userId: string): Promise<IUserDocument> {
    const users: IUserDocument[] = await UserModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(userId) } },
      { $lookup: { from: 'Auth', localField: 'authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },
      { $project: this.aggregateProject() }
    ]);
    return users[0];
  }

  public async getUserByAuthId(authId: string): Promise<IUserDocument> {
    const users: IUserDocument[] = await UserModel.aggregate([
      { $match: { authId: new mongoose.Types.ObjectId(authId) } },
      { $lookup: { from: 'Auth', localField: 'authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },
      { $project: this.aggregateProject() }
    ]);
    return users[0];
  }

  public async getAllUsers(userId: string, skip: number, limit: number): Promise<IUserDocument[]> {
    const users: IUserDocument[] = await UserModel.aggregate([
      { $match: { _id: { $ne: new mongoose.Types.ObjectId(userId) } } },
      { $skip: skip },
      { $limit: limit },
      { $sort: { createdAt: -1 } },
      { $lookup: { from: 'Auth', localField: 'authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },
      { $project: this.aggregateProject() }
    ]);
    return users;
  }

  public async getRandomUsers(userId: string): Promise<IUserDocument[]> {
    const randomUsers: IUserDocument[] = [];
    const users: IUserDocument[] = await UserModel.aggregate([
      { $match: { _id: { $ne: new mongoose.Types.ObjectId(userId) } } },
      { $lookup: { from: 'Auth', localField: 'authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },
      { $sample: { size: 10 } },
      {
        $addFields: {
          username: '$authId.username',
          email: '$authId.email',
          avatarColor: '$authId.avatarColor',
          uId: '$authId.uId',
          createdAt: '$authId.createdAt'
        }
      },
      {
        $project: {
          authId: 0,
          __v: 0
        }
      }
    ]);
    const followers: string[] = await followerService.getFolloweesIds(`${userId}`);
    for (const user of users) {
      const followerIndex = indexOf(followers, user._id.toString());
      if (followerIndex < 0) {
        randomUsers.push(user);
      }
    }
    return randomUsers;
  }

  public async getTotalUsersInDB(): Promise<number> {
    const totalCount: number = await UserModel.find({}).countDocuments();
    return totalCount;
  }

  public async getUsers(query: object, skip: number, limit: number, sortOptions: Record<string, 1 | -1>): Promise<IUserDocument[]> {
    try {
      const users: IUserDocument[] = await UserModel.aggregate([
        { $match: query },

        { $skip: skip },
        { $limit: limit },

        { $sort: sortOptions },

        // Kết hợp thông tin từ bảng Auth (nếu cần)
        { $lookup: { from: 'Auth', localField: 'authId', foreignField: '_id', as: 'authId' } },
        { $unwind: '$authId' },
        {
          $lookup: {
            from: 'ReportProfile',
            let: { userId: '$_id' }, // Đảm bảo truyền đúng userId
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [{ $eq: ['$reportedUserId', '$$userId'] }, { $eq: ['$reporterId', '$$userId'] }]
                  }
                }
              },
              { $project: { reason: 1, description: 1, status: 1, createdAt: 1 } } // Chỉ chọn các trường cần thiết
            ],
            as: 'reportProfileInfo' // Lưu kết quả vào trường này
          }
        },

        // Giải nổ mảng nếu có nhiều bản ghi trong reportProfileInfo
        { $unwind: { path: '$reportProfileInfo', preserveNullAndEmptyArrays: true } },

        { $project: this.aggregateProject() }
      ]);

      return users;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  public async searchUsers(regex: RegExp): Promise<ISearchUser[]> {
    const users = await AuthModel.aggregate([
      { $match: { username: regex } },
      { $lookup: { from: 'User', localField: '_id', foreignField: 'authId', as: 'user' } },
      { $unwind: '$user' },
      {
        $project: {
          _id: '$user._id',
          uId: '$uId',
          username: 1,
          email: 1,
          avatarColor: 1,
          profilePicture: '$user.profilePicture',
          followersCount: '$user.followersCount'
        }
      }
    ]);
    return users;
  }

  private aggregateProject() {
    return {
      _id: 1,
      username: '$authId.username',
      uId: '$authId.uId',
      email: '$authId.email',
      avatarColor: '$authId.avatarColor',
      createdAt: '$authId.createdAt',
      postsCount: 1,
      work: 1,
      school: 1,
      quote: 1,
      location: 1,
      blocked: 1,
      blockedBy: 1,
      followersCount: 1,
      followingCount: 1,
      notifications: 1,
      social: 1,
      bgImageVersion: 1,
      bgImageId: 1,
      profilePicture: 1,
      reportProfileInfo: {
        _id: '$reportProfileInfo._id',
        reason: '$reportProfileInfo.reason',
        description: '$reportProfileInfo.description',
        createdAt: '$reportProfileInfo.createdAt',
        status: '$reportProfileInfo.status'
      }
    };
  }
}

export const userService: UserService = new UserService();
