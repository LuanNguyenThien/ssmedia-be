import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { BadRequestError } from '@global/helpers/error-handler';
import { IGroupChat, IGroupChatDocument, IGroupChatMember } from '@chat/interfaces/group-chat.interface';
import { UploadApiResponse } from 'cloudinary';
import { uploads } from '@global/helpers/cloudinary-upload';
import { IMessageData } from '@chat/interfaces/chat.interface';
import { socketIOChatObject } from '@socket/chat';
import { cache } from '@service/redis/cache';
import { groupChatQueue } from '@service/queues/group-chat.queue';
import { createGroupChatSchema } from '@chat/schemes/group-chat';
import { IUserDocument } from '@user/interfaces/user.interface';
import { groupChatService } from '@service/db/group-chat.service';

const userCache = cache.userCache;
const messageCache = cache.messageCache;
const groupMessageCache = cache.groupMessageCache;

export class GroupChat {
  @joiValidation(createGroupChatSchema)
  public async create(req: Request, res: Response): Promise<void> {
    const { name, description, members } = req.body;
    let groupPicture = '';

    if (req.body.groupPicture) {
      const result: UploadApiResponse = (await uploads(req.body.groupPicture)) as UploadApiResponse;
      if (!result?.public_id) {
        throw new BadRequestError(result.message);
      }
      groupPicture = `https://res.cloudinary.com/di6ozapw8/image/upload/v${result.version}/${result.public_id}`;
    }

    const membersList: IGroupChatMember[] = [];
    
    const currentUser = await userCache.getUserFromCache(`${req.currentUser!.userId}`);
    membersList.push({
      userId: `${req.currentUser!.userId}`,
      username: `${req.currentUser!.username}`,
      avatarColor: `${req.currentUser!.avatarColor}`,
      profilePicture: currentUser?.profilePicture || '',
      role: 'admin',
      createdAt: new Date()
    });
    
    // Thêm các thành viên khác
    for (const memberId of members) {
      if (memberId !== req.currentUser!.userId) {
        const user = await userCache.getUserFromCache(`${memberId}`);
        if (user) {
          membersList.push({
            userId: `${memberId}`,
            username: user.username as string,
            avatarColor: user.avatarColor as string,
            profilePicture: user.profilePicture || '',
            role: 'member',
            createdAt: new Date()
          });
        }
      }
    }

    const groupId = new ObjectId();
    const groupChatData: IGroupChat = {
      _id: `${groupId}`,
      name,
      description,
      profilePicture: groupPicture,
      members: membersList,
      createdBy: `${req.currentUser!.userId}`,
      createdAt: new Date()
    };

    await groupMessageCache.createGroupChat(groupChatData);
    groupChatQueue.addGroupChatJob('createGroupChat', groupChatData);
    for (const member of membersList) {
      await messageCache.addChatListToCache(member.userId, `${groupId}`, `${groupId}`, 'group');
    }
    socketIOChatObject.emit('new group created', groupChatData);

    res.status(HTTP_STATUS.CREATED).json({ message: 'Group created successfully', group: groupChatData });
  }

  public async getGroupChat(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    let group: IGroupChatDocument;
    group = await groupChatService.getGroupChatById(groupId);
    // const groupCache: IGroupChatDocument = await groupMessageCache.getGroupChat(groupId);
    // if(groupCache && Object.keys(groupCache).length > 0) {
    //   group = groupCache;
    // } else {
    // }
    res.status(HTTP_STATUS.OK).json({ message: 'Group chat info', group });
  }

  // Thêm các phương thức khác: thêm/xóa thành viên, cập nhật thông tin nhóm, v.v.
}