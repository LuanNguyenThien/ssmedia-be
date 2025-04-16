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

  public async getBannedUsers(): Promise<IAuthDocument[]> {
    try {
      // Truy vấn tất cả người dùng bị ban
      const bannedUsers = await AuthModel.find({ isBanned: true });

      return bannedUsers;
    } catch (error) {
      console.error('Error fetching banned users:', error);
      return [];
    }
  }
}

export const userBanService: UserBanService = new UserBanService();
