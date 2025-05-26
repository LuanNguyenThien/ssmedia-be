import { AuthModel } from '@auth/models/auth.schema';
import { UserModel } from '@user/models/user.schema';
import { AppealModel } from '@appeal/models/appeal.schema';
import { IUserDocument } from '@user/interfaces/user.interface';
import { IAuthDocument } from '@auth/interfaces/auth.interface';

class UserBanService {
  // Ban user và trả về dữ liệu người dùng bị ban (nếu thành công)
  public async banUserByUserId(userId: string, reason: string): Promise<IAuthDocument | null> {
    const user: IUserDocument | null = await UserModel.findById(userId);
    if (!user) return null;

    const updatedAuth = await AuthModel.findOneAndUpdate(
      { _id: user.authId },
      {
        $set: {
          isBanned: true,
          bannedAt: new Date(),
          banReason: reason
        }
      },
      { new: true }
    );

    return updatedAuth;
  }
  public async getBanInfoByAuthId(authId: string): Promise<{ banReason: string | null; bannedAt: Date | null } | null> {
    const auth: IAuthDocument | null = await AuthModel.findById(authId);
    if (!auth || !auth.isBanned) return null;

    return {
      banReason: auth.banReason || null,
      bannedAt: auth.bannedAt || null
    };
  }

  // Unban user và trả về dữ liệu người dùng sau khi unban
  public async unbanUserByUserId(userId: string): Promise<IAuthDocument | null> {
    const user: IUserDocument | null = await UserModel.findById(userId);
    if (!user) return null;

    const updatedAuth = await AuthModel.findOneAndUpdate(
      { _id: user.authId },
      {
        $set: {
          isBanned: false,
          bannedAt: null,
          banReason: null
        }
      },
      { new: true }
    );

    return updatedAuth;
  }

  public async getBannedUsers(userId: string, skip: number, limit: number): Promise<IUserDocument[]> {
    try {
      const bannedAuths = await AuthModel.find({ isBanned: true });
      const authIds = bannedAuths.map((auth) => auth._id);

      const bannedUsers = await UserModel.find({ authId: { $in: authIds } }).populate('authId'); // Lấy thêm thông tin từ bảng Auth

      return bannedUsers;
    } catch (error) {
      console.error('Error fetching banned users:', error);
      return [];
    }
  }

  public async getUsersFromAppeals(skip: number, limit: number): Promise<any[]> {
    try {
      // Lấy các appeals có userId, content, status, createdAt
      const appeals = await AppealModel.find().select('userId content status createdAt').skip(skip).limit(limit); // Phân trang

      const userIds = appeals.map((appeal) => appeal.userId);
      const users = await UserModel.find({ _id: { $in: userIds } });

      const authIds = users.map((user) => user.authId).filter(Boolean);
      const auths = await AuthModel.find({ _id: { $in: authIds } }).select('username uId');

      // Map authId -> auth object (gồm username và uId)
      const authMap = new Map(auths.map((auth) => [auth._id.toString(), auth]));

      // Map userId -> user
      const userMap = new Map(users.map((user) => [user._id.toString(), user]));

      const result = appeals.map((appeal) => {
        const user = userMap.get(appeal.userId.toString());
        const auth = authMap.get(user?.authId?.toString() || '');

        return {
          ...user?.toObject(),
          username: auth?.username,
          uId: auth?.uId,
          appeal: {
            _id: appeal._id,
            content: appeal.content,
            status: appeal.status,
            createdAt: appeal.createdAt
          }
        };
      });

      return result;
    } catch (error) {
      console.error('Error fetching users from appeals:', error);
      return [];
    }
  }

  public async countUsersFromAppeals(): Promise<number> {
    try {
      // Đếm tổng số appeals để xác định tổng số người dùng đang kháng cáo
      return await AppealModel.countDocuments();
    } catch (error) {
      console.error('Error counting users from appeals:', error);
      return 0;
    }
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

export const userBanService: UserBanService = new UserBanService();
