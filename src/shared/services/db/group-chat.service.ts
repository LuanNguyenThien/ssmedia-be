import { IGroupChatDocument, IGroupChatMemberDocument } from "@chat/interfaces/group-chat.interface";
import { GroupChatModel } from "@chat/models/group-chat.schema";

class GroupChatService {
  public async createGroupChat(data: IGroupChatDocument): Promise<IGroupChatDocument> {
    const groupChat: IGroupChatDocument = await GroupChatModel.create(data);
    return groupChat;
  }

  public async getGroupChatById(groupId: string): Promise<IGroupChatDocument> {
    const groupChat: IGroupChatDocument = await GroupChatModel.findOne({ _id: groupId }).exec() as IGroupChatDocument;
    return groupChat;
  }

  public async getGroupChatByMemberId(userId: string): Promise<IGroupChatDocument[]> {
    const groupChats: IGroupChatDocument[] = await GroupChatModel.find({ 'members.userId': userId }).exec();
    return groupChats;
  }

  public async updateGroupChat(groupId: string, data: Partial<IGroupChatDocument>): Promise<IGroupChatDocument> {
    const groupChat: IGroupChatDocument = await GroupChatModel.findOneAndUpdate({ _id: groupId }, data, { new: true }).exec() as IGroupChatDocument;
    return groupChat;
  }

  public async updateGroupChatMembers(groupId: string, userId: string, data: IGroupChatMemberDocument): Promise<IGroupChatDocument> {
    const groupChat: IGroupChatDocument = await GroupChatModel.findOneAndUpdate({ _id: groupId, 'members.userId': userId }, data, { new: true }).exec() as IGroupChatDocument;
    return groupChat;
  }

  public async addGroupChatMember(groupId: string, newMember: IGroupChatMemberDocument): Promise<IGroupChatDocument> {
    const groupChat: IGroupChatDocument = await GroupChatModel.findOneAndUpdate(
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
    ).exec() as IGroupChatDocument;
  
    if (!groupChat) {
      throw new Error('Cannot add member to group chat. Group chat not found or member already exists');
    }
  
    return groupChat;
  }

  public async addGroupChatMembers(
    groupId: string, 
    newMembers: IGroupChatMemberDocument[]
  ): Promise<IGroupChatDocument> {
    const group = await this.getGroupChatById(groupId);
    if (!group) {
      throw new Error('Group chat not found');
    }
    
    // Lọc ra các thành viên chưa tồn tại trong nhóm
    const existingUserIds = group.members.map(member => member.userId.toString());
    const filteredNewMembers = newMembers.filter(
      member => !existingUserIds.includes(member.userId.toString())
    );
    
    // Nếu không có thành viên mới để thêm
    if (filteredNewMembers.length === 0) {
      return group;
    }
    
    // Chuẩn bị dữ liệu thành viên để thêm vào
    const membersToAdd = filteredNewMembers.map(member => ({
      userId: member.userId,
      username: member.username,
      avatarColor: member.avatarColor,
      profilePicture: member.profilePicture,
      role: member.role || 'member',
      createdAt: new Date()
    }));
    
    // Thực hiện cập nhật mảng members
    const groupChat: IGroupChatDocument = await GroupChatModel.findByIdAndUpdate(
      groupId,
      { 
        $push: { 
          members: { 
            $each: membersToAdd 
          } 
        } 
      },
      { new: true }
    ).exec() as IGroupChatDocument;
    
    if (!groupChat) {
      throw new Error('Failed to add members to group chat');
    }
    
    return groupChat;
  }

  public async removeGroupChatMember(groupId: string, userId: string): Promise<IGroupChatDocument> {
    // Kiểm tra xem người dùng có phải là admin duy nhất không
    const group = await this.getGroupChatById(groupId);
    const adminMembers = group.members.filter(member => member.role === 'admin');
    const isOnlyAdmin = adminMembers.length === 1 && adminMembers[0].userId.toString() === userId;
    
    if (isOnlyAdmin) {
        throw new Error('Cannot remove the only admin of the group chat');
    }

    const groupChat: IGroupChatDocument = await GroupChatModel.findOneAndUpdate(
        { _id: groupId },
        { $pull: { members: { userId: userId } } },
        { new: true }
    ).exec() as IGroupChatDocument;

    if (!groupChat) {
        throw new Error('Cannot remove member from group chat. Group chat not found or member does not exist');
    }

    return groupChat;
  }

  public async deleteGroupChat(groupId: string): Promise<void> {
    await GroupChatModel.deleteOne({ _id: groupId }).exec();
  }

  
}

export const groupChatService: GroupChatService = new GroupChatService();