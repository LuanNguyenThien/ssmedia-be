import { AuthModel } from '@auth/models/auth.schema';
import { UserModel } from '@user/models/user.schema';
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
