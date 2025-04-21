import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { IUserDocument } from '@user/interfaces/user.interface';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { addChatSchema } from '@chat/schemes/chat';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { UploadApiResponse } from 'cloudinary';
import { uploads } from '@global/helpers/cloudinary-upload';
import { BadRequestError } from '@global/helpers/error-handler';
import { IMessageData, IMessageNotification } from '@chat/interfaces/chat.interface';
import { socketIOChatObject } from '@socket/chat';
import { INotificationTemplate } from '@notification/interfaces/notification.interface';
import { notificationTemplate } from '@service/emails/templates/notifications/notification-template';
import { emailQueue } from '@service/queues/email.queue';
// import { MessageCache } from '@service/redis/message.cache';
// import { UserCache } from '@service/redis/user.cache';
import { cache } from '@service/redis/cache';
import { chatQueue } from '@service/queues/chat.queue';
import { IGroupChatDocument } from '@root/features/group-chat/interfaces/group-chat.interface';

// const messageCache: MessageCache = new MessageCache();
// const userCache: UserCache = new UserCache();
const userCache = cache.userCache;
const messageCache = cache.messageCache;
const groupMessageCache = cache.groupMessageCache;

export class Add {
  @joiValidation(addChatSchema)
  public async message(req: Request, res: Response): Promise<void> {
    const {
      conversationId, // Dùng cho cá nhân
      groupId,       // Dùng cho nhóm
      receiverId,
      receiverUsername,
      receiverAvatarColor,
      receiverProfilePicture,
      body,
      gifUrl,
      isRead,
      selectedImage,
      isGroupChat = false // Phân biệt nhóm hay cá nhân
    } = req.body;

    let fileUrl = '';
    const messageObjectId: ObjectId = new ObjectId();
    const conversationObjectId = conversationId ? 
    (mongoose.isValidObjectId(conversationId) ? new mongoose.Types.ObjectId(conversationId) : conversationId) : 
    new ObjectId();

    const sender: IUserDocument = (await userCache.getUserFromCache(`${req.currentUser!.userId}`)) as IUserDocument;
    let group: IGroupChatDocument | null = null;
    if (isGroupChat) {
      group = await groupMessageCache.getGroupChat(groupId); // Dùng messageCache thay groupMessageCache
      if (!group) {
        throw new BadRequestError('Group chat not found');
      }
    }

    if (selectedImage.length) {
      const result: UploadApiResponse = (await uploads(req.body.selectedImage)) as UploadApiResponse;
      if (!result?.public_id) {
        throw new BadRequestError(result.message);
      }
      fileUrl = `https://res.cloudinary.com/di6ozapw8/image/upload/v${result.version}/${result.public_id}`;
    }

    const messageData: IMessageData = {
      _id: `${messageObjectId}`,
      conversationId: isGroupChat ? null : (mongoose.isValidObjectId(conversationObjectId) ? 
      new mongoose.Types.ObjectId(conversationObjectId) : conversationObjectId),
      receiverId: isGroupChat ? undefined : receiverId,
      receiverAvatarColor: isGroupChat ? undefined : receiverAvatarColor,
      receiverProfilePicture: isGroupChat ? undefined : receiverProfilePicture,
      receiverUsername: isGroupChat ? undefined : receiverUsername,
      senderUsername: `${req.currentUser!.username}`,
      senderId: `${req.currentUser!.userId}`,
      senderAvatarColor: `${req.currentUser!.avatarColor}`,
      senderProfilePicture: `${sender.profilePicture}`,
      body,
      isRead,
      gifUrl,
      selectedImage: fileUrl,
      reaction: [],
      createdAt: new Date(),
      deleteForEveryone: false,
      deleteForMe: false,
      isGroupChat,
      groupId: isGroupChat ? groupId : undefined,
      groupName: isGroupChat ? group?.name : undefined,
      groupImage: isGroupChat ? group?.profilePicture : undefined,
    };
    Add.prototype.emitSocketIOEvent(messageData);

    if (!isRead) {
      if (isGroupChat && group) {
        await Add.prototype.groupMessageNotification(group, messageData);
      } else {
        Add.prototype.messageNotification({
          currentUser: req.currentUser!,
          message: body,
          receiverName: receiverUsername,
          receiverId,
          messageData
        });
      }
    }

    if(!isGroupChat) {
      await messageCache.addChatListToCache(`${req.currentUser!.userId}`, `${receiverId}`, `${conversationObjectId}`, 'personal');
      await messageCache.addChatListToCache(`${receiverId}`, `${req.currentUser!.userId}`, `${conversationObjectId}`, 'personal');
    }
    const chatId = isGroupChat ? groupId : `${conversationObjectId}`;
    await messageCache.addChatMessageToCache(chatId, messageData);
    chatQueue.addChatJob('addChatMessageToDB', messageData);

    res.status(HTTP_STATUS.OK).json({
      message: isGroupChat ? 'Message sent to group' : 'Message added',
      conversationId: isGroupChat ? undefined : conversationObjectId,
      groupId: isGroupChat ? groupId : undefined
    });
  }

  public async addChatUsers(req: Request, res: Response): Promise<void> {
    const chatUsers = await messageCache.addChatUsersToCache(req.body);
    socketIOChatObject.emit('add chat users', chatUsers);
    res.status(HTTP_STATUS.OK).json({ message: 'Users added' });
  }

  public async removeChatUsers(req: Request, res: Response): Promise<void> {
    const chatUsers = await messageCache.removeChatUsersFromCache(req.body);
    socketIOChatObject.emit('add chat users', chatUsers);
    res.status(HTTP_STATUS.OK).json({ message: 'Users removed' });
  }

  private emitSocketIOEvent(data: IMessageData): void {
    let roomId: string | ObjectId;
    if (data.isGroupChat) {
      roomId = data.groupId!;
    } else {
      roomId = data.conversationId!;
    }
    console.log(roomId);
    socketIOChatObject.emit('message received', data);
    socketIOChatObject.emit('chat list', data);
  }

  private async messageNotification({ currentUser, message, receiverName, receiverId }: IMessageNotification): Promise<void> {
    const cachedUser: IUserDocument = (await userCache.getUserFromCache(`${receiverId}`)) as IUserDocument;
    if (cachedUser.notifications.messages) {
      const templateParams: INotificationTemplate = {
        username: receiverName,
        message,
        header: `Message notification from ${currentUser.username}`
      };
      const template: string = notificationTemplate.notificationMessageTemplate(templateParams);
      emailQueue.addEmailJob('directMessageEmail', {
        receiverEmail: cachedUser.email!,
        template,
        subject: `You've received messages from ${currentUser.username}`
      });
    }
  }

  private async groupMessageNotification(group: IGroupChatDocument, messageData: IMessageData): Promise<void> {
    for (const member of group.members) {
      if (member.userId.toString() !== messageData.senderId) {
        Add.prototype.messageNotification({
          currentUser: { userId: messageData.senderId, username: messageData.senderUsername, avatarColor: messageData.senderAvatarColor },
          message: messageData.body,
          receiverName: member.username,
          receiverId: member.userId.toString(),
          messageData
        });
      }
    }
  }
}
