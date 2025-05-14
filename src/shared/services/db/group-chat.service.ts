import { IGroupChatDocument, IGroupChatMemberDocument } from '@root/features/group-chat/interfaces/group-chat.interface';
import { GroupChatModel } from '@root/features/group-chat/models/group-chat.schema';
import mongoose from 'mongoose';

class GroupChatService {
  public async getAllGroupChats(): Promise<IGroupChatDocument[]> {
    const groupChats: IGroupChatDocument[] = await GroupChatModel.find({}).exec();
    return groupChats;
  }

  public async createGroupChat(data: IGroupChatDocument): Promise<IGroupChatDocument> {
    const groupChat: IGroupChatDocument = await GroupChatModel.create(data);
    return groupChat;
  }

  public async getGroupChatById(groupId: string): Promise<IGroupChatDocument> {
    const groupChat: IGroupChatDocument = (await GroupChatModel.findOne({ _id: groupId }).exec()) as IGroupChatDocument;
    console.info('Fetching group chat with ID:', groupId, 'Result:', groupChat);
    return groupChat;
  }

  public async getGroupChatByMemberId(userId: string): Promise<IGroupChatDocument[]> {
    const groupChats: IGroupChatDocument[] = await GroupChatModel.find({ 'members.userId': userId }).exec();
    return groupChats;
  }

  public async updateGroupChat(groupId: string, data: Partial<IGroupChatDocument>): Promise<IGroupChatDocument> {
    const groupChat: IGroupChatDocument = (await GroupChatModel.findOneAndUpdate({ _id: groupId }, data, {
      new: true
    }).exec()) as IGroupChatDocument;
    return groupChat;
  }

  public async updateGroupChatMembers(groupId: string, userId: string, data: IGroupChatMemberDocument): Promise<IGroupChatDocument> {
    const groupChat: IGroupChatDocument = (await GroupChatModel.findOneAndUpdate({ _id: groupId, 'members.userId': userId }, data, {
      new: true
    }).exec()) as IGroupChatDocument;
    return groupChat;
  }

  public async addGroupChatMember(groupId: string, newMember: IGroupChatMemberDocument): Promise<IGroupChatDocument> {
    const groupChat: IGroupChatDocument = (await GroupChatModel.findOneAndUpdate(
      {
        _id: groupId,
        'members.userId': { $ne: newMember.userId } // Đảm bảo không thêm thành viên đã tồn tại
      },
      {
        $push: {
          members: {
            userId: newMember.userId,
            username: newMember.username,
            avatarColor: newMember.avatarColor,
            profilePicture: newMember.profilePicture,
            role: newMember.role || 'member',
            createdAt: new Date()
          }
        }
      },
      { new: true }
    ).exec()) as IGroupChatDocument;

    if (!groupChat) {
      throw new Error('Cannot add member to group chat. Group chat not found or member already exists');
    }

    return groupChat;
  }

  public async addGroupChatMembers(groupId: string, newMembers: IGroupChatMemberDocument[]): Promise<IGroupChatDocument> {
    const group = await this.getGroupChatById(groupId);
    console.info('Adding members to group chat:', groupId, 'with new members:', newMembers);
    if (!group) {
      throw new Error('Group chat not found');
    }

    // Lọc ra các thành viên chưa tồn tại trong nhóm
    const existingUserIds = group.members.map((member: IGroupChatMemberDocument) => member.userId.toString());
    const filteredNewMembers = newMembers.filter((member: IGroupChatMemberDocument) => !existingUserIds.includes(member.userId.toString()));

    // Nếu không có thành viên mới để thêm
    if (filteredNewMembers.length === 0) {
      return group;
    }

    // Chuẩn bị dữ liệu thành viên để thêm vào
    const membersToAdd = filteredNewMembers.map((member: IGroupChatMemberDocument) => ({
      userId: member.userId,
      username: member.username,
      avatarColor: member.avatarColor,
      profilePicture: member.profilePicture,
      role: member.role || 'member',
      state: member.state || 'pending', // Add state field with default value
      createdAt: new Date()
    }));

    // Thực hiện cập nhật mảng members
    const groupChat: IGroupChatDocument = (await GroupChatModel.findByIdAndUpdate(
      groupId,
      {
        $push: {
          members: {
            $each: membersToAdd
          }
        }
      },
      { new: true }
    ).exec()) as IGroupChatDocument;

    if (!groupChat) {
      throw new Error('Failed to add members to group chat');
    }

    return groupChat;
  }

  public async removeGroupChatMember(groupId: string, userId: string): Promise<IGroupChatDocument> {
    // Kiểm tra xem người dùng có phải là admin duy nhất không
    const group = await this.getGroupChatById(groupId);
    const adminMembers = group.members.filter((member: IGroupChatMemberDocument) => member.role === 'admin');
    const isOnlyAdmin = adminMembers.length === 1 && adminMembers[0].userId.toString() === userId;

    if (isOnlyAdmin) {
      throw new Error('Cannot remove the only admin of the group chat');
    }

    const groupChat: IGroupChatDocument = (await GroupChatModel.findOneAndUpdate(
      { _id: groupId },
      { $pull: { members: { userId: userId } } },
      { new: true }
    ).exec()) as IGroupChatDocument;

    if (!groupChat) {
      throw new Error('Cannot remove member from group chat. Group chat not found or member does not exist');
    }

    return groupChat;
  }

  public async deleteGroupChat(groupId: string): Promise<void> {
    await GroupChatModel.deleteOne({ _id: groupId }).exec();
  }

  public async getUserPendingGroups(userId: string): Promise<IGroupChatDocument[]> {
    try {
      // Convert string ID to ObjectId
      const objectId = new mongoose.Types.ObjectId(userId);

      const pendingGroups: IGroupChatDocument[] = await GroupChatModel.find({
        members: {
          $elemMatch: {
            userId: objectId,
            state: 'pending'
          }
        }
      }).exec();
      return pendingGroups;
    } catch (error) {
      console.error('Error in getUserPendingGroups:', error);
      return [];
    }
  }

  public async updateMemberState(groupId: string, userId: string, state: string): Promise<IGroupChatDocument> {
    const groupChat: IGroupChatDocument = (await GroupChatModel.findOneAndUpdate(
      {
        _id: groupId,
        'members.userId': userId
      },
      {
        $set: { 'members.$.state': state }
      },
      { new: true }
    ).exec()) as IGroupChatDocument;

    if (!groupChat) {
      throw new Error('Group chat not found or member does not exist');
    }

    return groupChat;
  }

  public async updateMemberRole(groupId: string, userId: string, role: string): Promise<IGroupChatDocument> {
    const groupChat: IGroupChatDocument = (await GroupChatModel.findOneAndUpdate(
      {
        _id: groupId,
        'members.userId': userId
      },
      {
        $set: { 
          'members.$.role': role,
          'members.$.state': 'accepted' // Always set state to accepted when updating role
        }
      },
      { new: true }
    ).exec()) as IGroupChatDocument;

    if (!groupChat) {
      throw new Error('Group chat not found or member does not exist');
    }

    return groupChat;
  }
}

export const groupChatService: GroupChatService = new GroupChatService();
