import { IMessageData } from '@chat/interfaces/chat.interface';
import { IConversationDocument } from '@chat/interfaces/conversation.interface';
import { ConversationModel } from '@chat/models/conversation.schema';
import { GroupChatModel } from '@chat/models/group-chat.schema';
import { MessageModel } from '@chat/models/chat.schema';
import { ObjectId } from 'mongodb';

class ChatService {
  public async addMessageToDB(data: IMessageData): Promise<void> {
    if (!data.isGroupChat) {
      const conversation: IConversationDocument[] = await ConversationModel.find({ _id: data?.conversationId }).exec();
      if (conversation.length === 0) {
        await ConversationModel.create({
          _id: data?.conversationId,
          senderId: data.senderId,
          receiverId: data.receiverId
        });
      }
    } else {
      // Nếu là tin nhắn nhóm, kiểm tra nhóm có tồn tại không
      const groupChat = await GroupChatModel.findById(data.groupId).exec();
      if (!groupChat) {
        throw new Error('Group chat not found');
      }
    }
  
    // Tạo tin nhắn mới
    await MessageModel.create({
      _id: data._id,
      conversationId: data.isGroupChat ? undefined : data.conversationId, // Chỉ dùng cho cá nhân
      senderId: data.senderId,
      receiverId: data.isGroupChat ? undefined : data.receiverId, // Chỉ dùng cho cá nhân
      senderUsername: data.senderUsername,
      senderAvatarColor: data.senderAvatarColor,
      senderProfilePicture: data.senderProfilePicture,
      receiverUsername: data.isGroupChat ? undefined : data.receiverUsername, // Chỉ dùng cho cá nhân
      receiverAvatarColor: data.isGroupChat ? undefined : data.receiverAvatarColor, // Chỉ dùng cho cá nhân
      receiverProfilePicture: data.isGroupChat ? undefined : data.receiverProfilePicture, // Chỉ dùng cho cá nhân
      isGroupChat: data.isGroupChat || false, // Mặc định là false nếu không truyền
      groupId: data.isGroupChat ? data.groupId : undefined, // Chỉ dùng cho nhóm
      groupName: data.isGroupChat ? data.groupName : undefined, // Chỉ dùng cho nhóm
      body: data.body,
      isRead: data.isRead,
      gifUrl: data.gifUrl,
      selectedImage: data.selectedImage,
      reaction: data.reaction,
      createdAt: data.createdAt
    });
  }

  public async getUserConversationList(userId: ObjectId): Promise<IMessageData[]> {
    // Bước 1: Lấy danh sách nhóm mà user tham gia
    const groupChats = await GroupChatModel.find({ 'members.userId': userId })
      .select('_id name profilePicture createdAt');

    if (!groupChats.length && !(await MessageModel.exists({ $or: [{ senderId: userId }, { receiverId: userId }] }))) {
      return [];
    }

    const groupIds = groupChats.map(g => g._id);

    // Bước 2: Lấy danh sách groupId có tin nhắn
    const groupIdsWithMessages = new Set(
      (await MessageModel.distinct('groupId', {
        groupId: { $in: groupIds },
        isGroupChat: true
      })).map(id => id.toString())
    );

    // Bước 3: Lấy tin nhắn cuối cùng từ MessageModel
    const messagesAggregation = await MessageModel.aggregate([
      {
        $match: {
          $or: [
            { senderId: userId },
            { receiverId: userId },
            { groupId: { $in: groupIds }, isGroupChat: true }
          ]
        }
      },
      {
        $sort: { createdAt: 1 } // Sắp xếp tăng dần theo createdAt, để $last lấy tin nhắn mới nhất
      },
      {
        $group: {
          _id: { $cond: [{ $eq: ['$isGroupChat', true] }, '$groupId', '$conversationId'] },
          result: { $last: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'GroupChat',
          localField: '_id',
          foreignField: '_id',
          as: 'groupInfo'
        }
      },
      {
        $project: {
          _id: '$result._id',
          conversationId: { $cond: [{ $eq: ['$result.isGroupChat', false] }, '$result.conversationId', undefined] },
          receiverId: '$result.receiverId',
          receiverUsername: '$result.receiverUsername',
          receiverAvatarColor: '$result.receiverAvatarColor',
          receiverProfilePicture: '$result.receiverProfilePicture',
          senderId: '$result.senderId',
          senderUsername: '$result.senderUsername',
          senderAvatarColor: '$result.senderAvatarColor',
          senderProfilePicture: '$result.senderProfilePicture',
          body: '$result.body',
          isRead: '$result.isRead',
          gifUrl: '$result.gifUrl',
          selectedImage: '$result.selectedImage',
          reaction: '$result.reaction',
          createdAt: '$result.createdAt',
          deleteForMe: '$result.deleteForMe',
          deleteForEveryone: '$result.deleteForEveryone',
          isGroupChat: '$result.isGroupChat',
          groupId: '$result.groupId',
          groupName: { $arrayElemAt: ['$groupInfo.name', 0] },
          groupImage: { $arrayElemAt: ['$groupInfo.profilePicture', 0] }
        }
      }
    ]);

    // Bước 4: Tạo danh sách chat từ aggregation và nhóm chưa có tin nhắn
    const chatList: IMessageData[] = [...messagesAggregation];

    groupChats.forEach((group) => {
      if (!groupIdsWithMessages.has(group._id.toString())) {
        chatList.push({
          _id: '',
          conversationId: undefined,
          receiverId: undefined,
          receiverUsername: undefined,
          receiverAvatarColor: undefined,
          receiverProfilePicture: undefined,
          senderId: '',
          senderUsername: '',
          senderAvatarColor: '',
          senderProfilePicture: '',
          body: '',
          isRead: true,
          gifUrl: '',
          selectedImage: '',
          reaction: [],
          createdAt: group.createdAt,
          deleteForMe: false,
          deleteForEveryone: false,
          isGroupChat: true,
          groupId: group._id,
          groupName: group.name,
          groupImage: group.profilePicture
        });
      }
    });

    // Bước 5: Sắp xếp theo createdAt
    chatList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return chatList;
  }

  public async getMessages(senderId: ObjectId, receiverIdOrGroupId: ObjectId, sort: Record<string, 1 | -1>, isGroupChat: boolean = false): Promise<IMessageData[]> {
    const query = isGroupChat
    ? { groupId: receiverIdOrGroupId, isGroupChat: true }
    : {
      $or: [
        { senderId, receiverId: receiverIdOrGroupId, isGroupChat: false},
        { senderId: receiverIdOrGroupId, receiverId: senderId, isGroupChat: false}
      ]
    };
    const messages: IMessageData[] = await MessageModel.aggregate([{ $match: query }, { $sort: sort }]);
    return messages;
  }

  public async markMessageAsDeleted(messageId: string, type: string): Promise<void> {
    if (type === 'deleteForMe') {
      await MessageModel.updateOne({ _id: messageId }, { $set: { deleteForMe: true } }).exec();
    } else {
      await MessageModel.updateOne({ _id: messageId }, { $set: { deleteForMe: true, deleteForEveryone: true } }).exec();
    }
  }

  public async markMessagesAsRead(senderId: ObjectId, receiverId: ObjectId): Promise<void> {
    const query = {
      $or: [
        { senderId, receiverId, isRead: false },
        { senderId: receiverId, receiverId: senderId, isRead: false }
      ]
    };
    await MessageModel.updateMany(query, { $set: { isRead: true } }).exec();
  }

  public async updateMessageReaction(messageId: ObjectId, senderName: string, reaction: string, type: 'add' | 'remove'): Promise<void> {
    if (type === 'add') {
      await MessageModel.updateOne(
        { _id: messageId },
        [
          {
            $set: {
              reaction: {
                $filter: {
                  input: '$reaction',
                  cond: { $ne: ['$$this.senderName', senderName] } // Xóa reaction cũ của senderName
                }
              }
            }
          },
          {
            $set: {
              reaction: {
                $concatArrays: [
                  '$reaction',
                  type === 'add' ? [{ senderName, type: reaction }] : [] // Thêm reaction mới nếu type là 'add'
                ]
              }
            }
          }
        ]
      ).exec();
    } else {
      await MessageModel.updateOne({ _id: messageId }, { $pull: { reaction: { senderName } } }).exec();
    }
  }
}

export const chatService: ChatService = new ChatService();
