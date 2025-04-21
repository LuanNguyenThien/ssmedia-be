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
    }
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
}