import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { config } from '@root/config';
import { IGroupChat, IGroupChatDocument, IGroupChatMember } from '@root/features/group-chat/interfaces/group-chat.interface';
import { ServerError } from '@global/helpers/error-handler';
import { IMessageData } from '@chat/interfaces/chat.interface';
import { Helpers } from '@global/helpers/helpers';

const log: Logger = config.createLogger('groupMessageCache');

export class GroupMessageCache extends BaseCache {
  constructor() {
    super('groupMessageCache');
  }

  public async createGroupChat(groupChat: IGroupChat): Promise<IGroupChat> {
    const { _id, name, description, profilePicture, members, createdBy, createdAt } = groupChat;
    const dataToSave = {
        '_id': `${_id}`,
        'name': `${name}`,
        'description': `${description || ''}`,
        'profilePicture': `${profilePicture || ''}`,
        'members': JSON.stringify(members),
        'createdBy': `${createdBy}`,
        'createdAt': createdAt.toISOString()
    };
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      // Lưu thông tin nhóm
      await this.client.HSET(`groupChats:${_id}`, dataToSave);
      // Lưu danh sách nhóm cho từng thành viên
      for (const member of members) {
        await this.client.SADD(`userGroups:${member.userId}`, `${_id}`);
      }
      
      return groupChat;
    } catch (error) {
      log.error(error);
      throw new ServerError('Error creating group chat in cache');
    }
  }

  public async getGroupChat(groupId: string): Promise<IGroupChatDocument> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      const group = await this.client.HGETALL(`groupChats:${groupId}`);
      
      // Check if we actually got data back
      if (!group || Object.keys(group).length === 0) {
        log.info(`No group found in cache with ID: ${groupId}`);
        return {} as IGroupChatDocument; // Return empty object to signal missing data
      }
      
      // Parse members JSON string to object
      if (group && group.members) {
        group.members = Helpers.parseJson(group.members);
      }
    
      return group as unknown as IGroupChatDocument;
    } catch (error) {
      log.error(error);
      throw new ServerError('Error getting group chat from cache');
    }
  }

  public async addGroupChatMessageToCache(groupId: string, message: IMessageData): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      await this.client.LPUSH(`groupMessages:${groupId}`, JSON.stringify(message));
    } catch (error) {
      log.error(error);
      throw new ServerError('Error adding group message to cache');
    }
  }

  public async getGroupChatMessages(groupId: string, limit: number, offset: number): Promise<IMessageData[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      const messages = await this.client.LRANGE(`groupMessages:${groupId}`, offset, offset + limit - 1);
      return messages.map((message: string) => JSON.parse(message));
    } catch (error) {
      log.error(error);
      throw new ServerError('Error getting group messages from cache');
    }
  }

  public async addMemberToGroup(
    groupId: string,
    newMember: IGroupChatMember
  ): Promise<IGroupChat | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      const group = await this.client.HGETALL(`groupChats:${groupId}`);
      
      if (!group || !group.members) {
        return null;
      }
      
      const members = Helpers.parseJson(group.members) as IGroupChatMember[];
      
      // Kiểm tra xem thành viên đã tồn tại chưa
      const existingMember = members.find((member: IGroupChatMember) => member.userId === newMember.userId);
      if (existingMember) {
        return group as unknown as IGroupChat; // Thành viên đã tồn tại, không thay đổi gì
      }
      
      members.push({
        ...newMember,
        createdAt: new Date() // Đảm bảo thời gian tham gia được ghi lại
      });
      
      // Cập nhật lại danh sách thành viên
      await this.client.HSET(`groupChats:${groupId}`, 'members', JSON.stringify(members));
      // Thêm nhóm vào danh sách nhóm của thành viên mới
      await this.client.SADD(`userGroups:${newMember.userId}`, groupId);
      
      // Trả về thông tin nhóm đã cập nhật
      group.members = JSON.stringify(members);
      return group as unknown as IGroupChat;
    } catch (error) {
      log.error(error);
      throw new ServerError('Error adding member to group chat');
    }
  }

  public async updateUserInfoInGroups(
    userId: string,
    updatedInfo: { username?: string; avatarColor?: string; profilePicture?: string }
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      // Lấy danh sách nhóm mà người dùng tham gia
      const userGroups = await this.client.SMEMBERS(`userGroups:${userId}`);
      
      // Cập nhật thông tin người dùng trong từng nhóm
      for (const groupId of userGroups) {
        const group = await this.client.HGETALL(`groupChats:${groupId}`);
        
        if (group && group.members) {
          const members = Helpers.parseJson(group.members) as IGroupChatMember[];
          // Tìm và cập nhật thông tin của thành viên
          const updatedMembers = members.map((member: IGroupChatMember) => {
            if (member.userId === userId) {
              return {
                ...member,
                ...updatedInfo
              };
            }
            return member;
          });
          
          // Lưu lại mảng members đã cập nhật
          await this.client.HSET(`groupChats:${groupId}`, 'members', JSON.stringify(updatedMembers));
        }
      }
    } catch (error) {
      log.error(error);
      throw new ServerError('Error updating user information in group chats');
    }
  }

  public async removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      const group = await this.client.HGETALL(`groupChats:${groupId}`);
      
      if (!group || !group.members) {
        return;
      }
      
      const members = Helpers.parseJson(group.members) as IGroupChatMember[];
      
      // Lọc ra thành viên cần xóa
      const updatedMembers = members.filter((member: IGroupChatMember) => member.userId !== userId);
      // Cập nhật lại danh sách thành viên
      await this.client.HSET(`groupChats:${groupId}`, 'members', JSON.stringify(updatedMembers));
      // Xóa nhóm khỏi danh sách nhóm của thành viên
      await this.client.SREM(`userGroups:${userId}`, groupId);
    } catch (error) {
      log.error(error);
      throw new ServerError('Error removing member from group chat');
    }
  }

  public async updateGroupAvatar(groupId: string, avatarUrl: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      // Update the avatar URL in the group data
      await this.client.HSET(`groupChats:${groupId}`, 'profilePicture', avatarUrl);
      
      // Update the cached group information
      const group = await this.client.HGETALL(`groupChats:${groupId}`);
      
      if (group && group.members) {
        // Parse members to JSON for updating in memory
        const members = Helpers.parseJson(group.members) as IGroupChatMember[];
        group.members = JSON.stringify(members);
        
        // You could potentially do more processing here if needed
      }
      
      log.info(`Group avatar updated in cache for group ${groupId}`);
    } catch (error) {
      log.error(error);
      throw new ServerError('Error updating group avatar in cache');
    }
  }

  public async updateGroupInfo(groupId: string, updateData: Partial<IGroupChat |IGroupChatDocument>): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      // Update the group info fields
      for (const [key, value] of Object.entries(updateData)) {
        if (key === 'members') {
          await this.client.HSET(`groupChats:${groupId}`, key, JSON.stringify(value));
        } else if (value !== undefined) {
          await this.client.HSET(`groupChats:${groupId}`, key, `${value}`);
        }
      }
      
      log.info(`Group info updated in cache for group ${groupId}`);
    } catch (error) {
      log.error(error);
      throw new ServerError('Error updating group information in cache');
    }
  }

  public async deleteGroupFromCache(groupId: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      // Get all members before deletion to remove from their userGroups
      const group = await this.getGroupChat(groupId);
      if (group && group.members && Array.isArray(group.members)) {
        for (const member of group.members) {
          await this.client.SREM(`userGroups:${member.userId}`, groupId);
        }
      }
      
      // Delete group data and messages
      await this.client.DEL(`groupChats:${groupId}`);
      await this.client.DEL(`groupMessages:${groupId}`);
      
      log.info(`Group ${groupId} deleted from cache`);
    } catch (error) {
      log.error(error);
      throw new ServerError('Error deleting group from cache');
    }
  }

  public async updateMemberState(groupId: string, userId: string, state: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      const group = await this.client.HGETALL(`groupChats:${groupId}`);
      if (!group || !group.members) {
        return;
      }
      
      const members = Helpers.parseJson(group.members) as IGroupChatMember[];
      const updatedMembers = members.map((member: IGroupChatMember) => {
        if (member.userId === userId) {
          return {
            ...member,
            state
          };
        }
        return member;
      });
      
      await this.client.HSET(`groupChats:${groupId}`, 'members', JSON.stringify(updatedMembers));
      
      log.info(`Member ${userId} state updated to ${state} in group ${groupId}`);
    } catch (error) {
      log.error(error);
      throw new ServerError('Error updating member state in cache');
    }
  }

  public async updateMemberRole(groupId: string, userId: string, role: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      const group = await this.client.HGETALL(`groupChats:${groupId}`);
      if (!group || !group.members) {
        return;
      }
      
      const members = Helpers.parseJson(group.members) as IGroupChatMember[];
      const updatedMembers = members.map((member: IGroupChatMember) => {
        if (member.userId === userId) {
          return {
            ...member,
            role,
            state: 'accepted' // Always set state to accepted when updating role
          };
        }
        return member;
      });
      
      await this.client.HSET(`groupChats:${groupId}`, 'members', JSON.stringify(updatedMembers));
      
      log.info(`Member ${userId} role updated to ${role} in group ${groupId}`);
    } catch (error) {
      log.error(error);
      throw new ServerError('Error updating member role in cache');
    }
  }

  public async getUserPendingGroups(userId: string): Promise<string[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      
      const userGroups = await this.client.SMEMBERS(`userGroups:${userId}`);
      if (!userGroups.length) return [];
      
      // Use Promise.all instead of pipeline
      const membersJsonArray = await Promise.all(
        userGroups.map(groupId => 
          this.client.HGET(`groupChats:${groupId}`, 'members')
        )
      );
      
      const pendingGroups: string[] = [];
      
      // Process all results
      for (let i = 0; i < membersJsonArray.length; i++) {
        const membersJson = membersJsonArray[i];
        
        // Skip null values
        if (!membersJson) continue;
        
        try {
          const members = Helpers.parseJson(membersJson) as IGroupChatMember[];
          const member = members.find((m: IGroupChatMember) => m.userId === userId);
          
          if (member && member.state === 'pending') {
            pendingGroups.push(userGroups[i]);
          }
        } catch (parseError) {
          log.error(`Failed to parse members for group ${userGroups[i]}: ${parseError}`);
        }
      }
      
      return pendingGroups;
    } catch (error) {
      log.error(`Redis error in getUserPendingGroups for user ${userId}:`, error);
      return [];
    }
  }
}