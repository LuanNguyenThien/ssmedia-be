import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import mongoose from 'mongoose';
import { chatService } from '@service/db/chat.service';
import { IMessageData } from '@chat/interfaces/chat.interface';
import { cache } from '@service/redis/cache';
// import { MessageCache } from '@service/redis/message.cache';

// const messageCache: MessageCache = new MessageCache();
const messageCache = cache.messageCache;

export class Get {
  public async conversationList(req: Request, res: Response): Promise<void> {
    let list: IMessageData[] = [];
    list = await chatService.getUserConversationList(new mongoose.Types.ObjectId(req.currentUser!.userId));
    // const cachedList: IMessageData[] = await messageCache.getUserConversationList(`${req.currentUser!.userId}`);
    // if (cachedList.length) {
    //   list = cachedList;
    // } else {
    // }

    res.status(HTTP_STATUS.OK).json({ message: 'User conversation list', list });
  }

  public async messages(req: Request, res: Response): Promise<void> {
    const { receiverId } = req.params;
    const { isGroupChat = 'false' } = req.query;
    const isGroup = isGroupChat === 'true';

    let messages: IMessageData[] = [];
    messages = await chatService.getMessages(
      new mongoose.Types.ObjectId(req.currentUser!.userId),
      new mongoose.Types.ObjectId(receiverId),
      { createdAt: 1 }, isGroup
    );
    // const cachedMessages: IMessageData[] = await messageCache.getChatMessagesFromCache(`${req.currentUser!.userId}`, `${receiverId}`, isGroup);
    // if (cachedMessages.length) {
    //   messages = cachedMessages;
    // } else {
    // }

    res.status(HTTP_STATUS.OK).json({ message: 'User chat messages', messages });
  }
}
