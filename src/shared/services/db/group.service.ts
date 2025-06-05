import { IGroupCreate, IGroupMember, IGroupDocument } from '@root/features/group/interfaces/group.interface';
import { GroupModel } from '@root/features/group/models/group.schema';
import mongoose from 'mongoose';

class GroupService {
  public async createGroup(data: IGroupCreate): Promise<IGroupCreate> {
    const group: IGroupCreate = await GroupModel.create(data);
    return group;
  }
  public async getGroupsByUserId(userId: string): Promise<IGroupDocument[]> {
    const groups = await GroupModel.find({
      members: {
        $elemMatch: {
          userId: userId,
          status: 'active'
        }
      }
    });
    return groups;
  }

  public async getGroupById(groupId: string): Promise<IGroupDocument | null> {
    return GroupModel.findById(groupId);
  }

  public async updateGroup(groupId: string, data: Partial<IGroupDocument>): Promise<IGroupDocument> {
    const group: IGroupDocument = (await GroupModel.findOneAndUpdate({ _id: groupId }, data, {
      new: true
    }).exec()) as IGroupDocument;

    return group;
  }

  public async addMembersToGroup(groupId: string, newMembers: IGroupMember[]): Promise<IGroupDocument | null> {
    const group = await GroupModel.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Lọc các thành viên chưa có trong nhóm (tránh trùng)
    const existingUserIds = new Set(group.members.map((m) => m.userId.toString()));
    const filteredMembers = newMembers.filter((m) => !existingUserIds.has(m.userId.toString()));

    if (filteredMembers.length === 0) {
      return group;
    }

    // Thêm thành viên mới
    group.members.push(...filteredMembers);

    // Lưu nhóm
    await group.save();

    return group;
  }

  public async removeMembersFromGroup(groupId: string, memberIds: string[]): Promise<IGroupDocument | null> {
    // Xóa member khỏi mảng members theo userId
    const updatedGroup = await GroupModel.findByIdAndUpdate(groupId, { $pull: { members: { userId: { $in: memberIds } } } }, { new: true });

    return updatedGroup;
  }

  public async deleteGroupById(groupId: string): Promise<void> {
    await GroupModel.findByIdAndDelete(groupId);
  }

  public async getUserPendingGroups(userId: string): Promise<IGroupDocument[]> {
    try {
      const objectId = new mongoose.Types.ObjectId(userId);

      const pendingGroups: IGroupDocument[] = await GroupModel.find({
        members: {
          $elemMatch: {
            userId: objectId,
            status: 'pending_user'
          }
        }
      }).exec();

      return pendingGroups;
    } catch (error) {
      console.error('Error in getUserPendingGroups:', error);
      return [];
    }
  }

  public async saveGroup(group: IGroupDocument): Promise<IGroupDocument> {
    return await group.save();
  }

  public async rejectGroupInvitation(groupId: string, userId: string): Promise<void> {
    const objectGroupId = new mongoose.Types.ObjectId(groupId);
    const objectUserId = new mongoose.Types.ObjectId(userId);

    await GroupModel.updateOne(
      {
        _id: objectGroupId,
        'members.userId': objectUserId,
        'members.status': 'pending_user'
      },
      {
        $set: {
          'members.$.status': 'rejected'
        }
      }
    );
  }

  public async approveMemberByAdmin(groupId: string, userId: string): Promise<void> {
    await GroupModel.updateOne(
      {
        _id: new mongoose.Types.ObjectId(groupId),
        'members.userId': new mongoose.Types.ObjectId(userId),
        'members.status': 'pending_admin'
      },
      {
        $set: {
          'members.$.status': 'active'
        }
      }
    ).exec();
  }

  public async rejectMemberByAdmin(groupId: string, userId: string): Promise<void> {
    await GroupModel.updateOne(
      {
        _id: new mongoose.Types.ObjectId(groupId),
        'members.userId': new mongoose.Types.ObjectId(userId),
        'members.status': 'pending_admin'
      },
      {
        $set: {
          'members.$.status': 'rejected'
        }
      }
    ).exec();
  }

  public async LeaveGroup(groupId: string, memberIds: string[]): Promise<IGroupDocument> {
    const objectIds = memberIds.map((id) => new mongoose.Types.ObjectId(id));
    const group = await GroupModel.findByIdAndUpdate(
      groupId,
      {
        $pull: {
          members: {
            userId: { $in: objectIds }
          }
        }
      },
      { new: true }
    );
    return group!;
  }

  public async addMember(groupId: string, member: any) {
    await GroupModel.findByIdAndUpdate(groupId, { $push: { members: member } }, { new: true });
  }

  public async getGroupsUserNotJoined(userId: string): Promise<IGroupDocument[]> {
    const objectId = new mongoose.Types.ObjectId(userId);

    const groups = await GroupModel.find({
      'members.userId': { $ne: objectId } // loại trừ các group mà user đã là thành viên
    });

    return groups;
  }
}



export const groupService: GroupService = new GroupService();
