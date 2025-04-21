import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { findIndex, find, filter, remove } from 'lodash';
import { config } from '@root/config';
import { ServerError } from '@global/helpers/error-handler';
import { IMessageData, IChatUsers, IChatList, IGetMessageFromCache } from '@chat/interfaces/chat.interface';
import { Helpers } from '@global/helpers/helpers';
import { IReaction } from '@reaction/interfaces/reaction.interface';
import { GroupMessageCache } from './group-message.cache';

const groupMessageCache = new GroupMessageCache();
const log: Logger = config.createLogger('messageCache');

export class MessageCache extends BaseCache {
  constructor() {
    super('messageCache');
  }

  public async addChatListToCache(senderId: string, receiverId: string, id: string, type: 'personal' | 'group'): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const userChatList = await this.client.LRANGE(`chatList:${senderId}`, 0, -1);
      const chatItem = type === 'personal' ? { type, receiverId, conversationId: id } : { type, groupId: id };
      if (userChatList.length === 0) {
        await this.client.RPUSH(`chatList:${senderId}`, JSON.stringify(chatItem));
      } else {
        const itemIndex: number = findIndex(userChatList, (listItem: string) => 
        {
          const parsed = Helpers.parseJson(listItem);
          return type === 'personal' ? parsed.receiverId === receiverId : parsed.groupId === id;
        });
        if (itemIndex < 0) {
          await this.client.RPUSH(`chatList:${senderId}`, JSON.stringify(chatItem));
        }
      }
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async addChatMessageToCache(conversationId: string, value: IMessageData): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      await this.client.RPUSH(`messages:${conversationId}`, JSON.stringify(value));
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async addChatUsersToCache(value: IChatUsers): Promise<IChatUsers[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const users: IChatUsers[] = await this.getChatUsersList();
      const usersIndex: number = findIndex(users, (listItem: IChatUsers) => JSON.stringify(listItem) === JSON.stringify(value));
      let chatUsers: IChatUsers[] = [];
      if (usersIndex === -1) {
        await this.client.RPUSH('chatUsers', JSON.stringify(value));
        chatUsers = await this.getChatUsersList();
      } else {
        chatUsers = users;
      }
      return chatUsers;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async removeChatUsersFromCache(value: IChatUsers): Promise<IChatUsers[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const users: IChatUsers[] = await this.getChatUsersList();
      const usersIndex: number = findIndex(users, (listItem: IChatUsers) => JSON.stringify(listItem) === JSON.stringify(value));
      let chatUsers: IChatUsers[] = [];
      if (usersIndex > -1) {
        await this.client.LREM('chatUsers', usersIndex, JSON.stringify(value));
        chatUsers = await this.getChatUsersList();
      } else {
        chatUsers = users;
      }
      return chatUsers;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getUserConversationList(key: string): Promise<IMessageData[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const userChatList: string[] = await this.client.LRANGE(`chatList:${key}`, 0, -1);
      const conversationChatList: IMessageData[] = [];
      for (const item of userChatList) {
        const chatItem: IChatList = Helpers.parseJson(item) as IChatList;
        const id = chatItem.type === 'personal' ? chatItem.conversationId : chatItem.groupId;
        const lastMessage: string = (await this.client.LINDEX(`messages:${id}`, -1)) as string;
        if (lastMessage) {
          const message: IMessageData = Helpers.parseJson(lastMessage);
          if (chatItem.type === 'group') {
            const group = await groupMessageCache.getGroupChat(id as string);
            message.groupId = id;
            message.groupName = group?.name;
            message.groupImage = group?.profilePicture;
            message.isGroupChat = true;
          }
          conversationChatList.push(message);
        } else if (chatItem.type === 'group') {
          const group = await groupMessageCache.getGroupChat(id as string);
          const message: IMessageData = {
            _id: '', // Có thể để trống hoặc tạo ID tạm
            conversationId: undefined,
            receiverId: undefined,
            receiverUsername: undefined,
            receiverAvatarColor: undefined,
            receiverProfilePicture: undefined,
            senderUsername: '',
            senderId: '',
            senderAvatarColor: '',
            senderProfilePicture: '',
            gifUrl: '',
            selectedImage: '',
            reaction: [],
            body: '', // Không có nội dung
            createdAt: group.createdAt,
            isRead: true, // Mặc định đã đọc
            deleteForMe: false,
            deleteForEveryone: false,
          };
          message.groupId = id;
          message.groupName = group?.name;
          message.isGroupChat = true;
          message.groupImage = group?.profilePicture;
          conversationChatList.push(message);
        }
      }
      return conversationChatList;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getChatMessagesFromCache(senderId: string, receiverId: string, isGroupChat: boolean = false): Promise<IMessageData[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const userChatList: string[] = await this.client.LRANGE(`chatList:${senderId}`, 0, -1);
      let chatItem: string | undefined;
      if (isGroupChat) {
        chatItem = userChatList.find((item: string) => {
          const parsed = Helpers.parseJson(item) as { type: string; groupId?: string };
          return parsed.type === 'group' && parsed.groupId === receiverId;
        });
      } else {
        chatItem = userChatList.find((item: string) => {
          const parsed = Helpers.parseJson(item) as { type: string; receiverId?: string };
          return parsed.type === 'personal' && parsed.receiverId === receiverId;
        });
      }
      if (!chatItem) {
        return []; // Không tìm thấy chat list phù hợp
      }
      const parsedChatItem = Helpers.parseJson(chatItem) as { conversationId?: string; groupId?: string };
      const chatId = isGroupChat ? parsedChatItem.groupId : parsedChatItem.conversationId;

      if (!chatId) {
        return []; // Không có chatId hợp lệ
      }

      const userMessages: string[] = await this.client.LRANGE(`messages:${chatId}`, 0, -1);
      const chatMessages: IMessageData[] = userMessages.map((item) => Helpers.parseJson(item) as IMessageData);

      return chatMessages;
      // const receiver: string = find(userChatList, (listItem: string) => listItem.includes(receiverId)) as string;
      // const parsedReceiver: IChatList = Helpers.parseJson(receiver) as IChatList;
      // if (parsedReceiver) {
      //   const userMessages: string[] = await this.client.LRANGE(`messages:${parsedReceiver.conversationId}`, 0, -1);
      //   const chatMessages: IMessageData[] = [];
      //   for (const item of userMessages) {
      //     const chatItem = Helpers.parseJson(item) as IMessageData;
      //     chatMessages.push(chatItem);
      //   }
      //   return chatMessages;
      // } else {
      //   return [];
      // }
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async markMessageAsDeleted(senderId: string, receiverId: string, messageId: string, type: string): Promise<IMessageData> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const { index, message, receiver } = await this.getMessage(senderId, receiverId, messageId);
      const chatItem = Helpers.parseJson(message) as IMessageData;
      if (type === 'deleteForMe') {
        chatItem.deleteForMe = true;
      } else {
        chatItem.deleteForMe = true;
        chatItem.deleteForEveryone = true;
      }
      await this.client.LSET(`messages:${receiver.conversationId}`, index, JSON.stringify(chatItem));

      const lastMessage: string = (await this.client.LINDEX(`messages:${receiver.conversationId}`, index)) as string;
      return Helpers.parseJson(lastMessage) as IMessageData;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async updateChatMessages(senderId: string, receiverId: string): Promise<IMessageData> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const userChatList: string[] = await this.client.LRANGE(`chatList:${senderId}`, 0, -1);
      const receiver: string = find(userChatList, (listItem: string) => listItem.includes(receiverId)) as string;
      const parsedReceiver: IChatList = Helpers.parseJson(receiver) as IChatList;
      const messages: string[] = await this.client.LRANGE(`messages:${parsedReceiver.conversationId}`, 0, -1);
      const unreadMessages: string[] = filter(messages, (listItem: string) => !Helpers.parseJson(listItem).isRead);
      for (const item of unreadMessages) {
        const chatItem = Helpers.parseJson(item) as IMessageData;
        const index = findIndex(messages, (listItem: string) => listItem.includes(`${chatItem._id}`));
        chatItem.isRead = true;
        await this.client.LSET(`messages:${chatItem.conversationId}`, index, JSON.stringify(chatItem));
      }
      const lastMessage: string = (await this.client.LINDEX(`messages:${parsedReceiver.conversationId}`, -1)) as string;
      return Helpers.parseJson(lastMessage) as IMessageData;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async updateMessageReaction(
    conversationId: string,
    messageId: string,
    reaction: string,
    senderName: string,
    type: 'add' | 'remove'
  ): Promise<IMessageData> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const messages: string[] = await this.client.LRANGE(`messages:${conversationId}`, 0, -1);
      const messageIndex: number = findIndex(messages, (listItem: string) => listItem.includes(messageId));
      const message: string = (await this.client.LINDEX(`messages:${conversationId}`, messageIndex)) as string;
      const parsedMessage: IMessageData = Helpers.parseJson(message) as IMessageData;
      const reactions: IReaction[] = [];
      if (parsedMessage) {
        remove(parsedMessage.reaction, (reaction: IReaction) => reaction.senderName === senderName);
        if (type === 'add') {
          reactions.push({ senderName, type: reaction });
          parsedMessage.reaction = [...parsedMessage.reaction, ...reactions];
          await this.client.LSET(`messages:${conversationId}`, messageIndex, JSON.stringify(parsedMessage));
        } else {
          await this.client.LSET(`messages:${conversationId}`, messageIndex, JSON.stringify(parsedMessage));
        }
      }
      const updatedMessage: string = (await this.client.LINDEX(`messages:${conversationId}`, messageIndex)) as string;
      return Helpers.parseJson(updatedMessage) as IMessageData;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  private async getChatUsersList(): Promise<IChatUsers[]> {
      const chatUsersList: IChatUsers[] = [];
      try {
        // Kiểm tra kết nối của client
        if (!this.client.isOpen) {
          await this.client.connect();
        }
  
        const chatUsers = await this.client.LRANGE('chatUsers', 0, -1);
        for (const item of chatUsers) {
          const chatUser: IChatUsers = Helpers.parseJson(item) as IChatUsers;
          chatUsersList.push(chatUser);
        }
      } catch (error) {
        console.error('Error fetching chat users list:', error);
      }
      return chatUsersList;
    }

  private async getMessage(senderId: string, receiverId: string, messageId: string): Promise<IGetMessageFromCache> {
    const userChatList: string[] = await this.client.LRANGE(`chatList:${senderId}`, 0, -1);
    const receiver: string = find(userChatList, (listItem: string) => listItem.includes(receiverId)) as string;
    const parsedReceiver: IChatList = Helpers.parseJson(receiver) as IChatList;
    const messages: string[] = await this.client.LRANGE(`messages:${parsedReceiver.conversationId}`, 0, -1);
    const message: string = find(messages, (listItem: string) => listItem.includes(messageId)) as string;
    const index: number = findIndex(messages, (listItem: string) => listItem.includes(messageId));

    return { index, message, receiver: parsedReceiver };
  }
}
