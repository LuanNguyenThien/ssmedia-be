import { Server, Socket } from 'socket.io';
import { connectedUsersMap } from './user';
import { groupChatService } from '@service/db/group-chat.service';
import { cache } from '@service/redis/cache';
import { IMessageData } from '@chat/interfaces/chat.interface';
import { chatQueue } from '@service/queues/chat.queue';
import mongoose from 'mongoose';
import { IGroupChatMember } from '@root/features/group-chat/interfaces/group-chat.interface';

export let socketIOGroupChatObject: Server;
const groupMessageCache = cache.groupMessageCache;
const messageCache = cache.messageCache;

export class SocketIOGroupChatHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    socketIOGroupChatObject = io;
  }

  public listen(): void {
    this.io.on('connection', (socket: Socket) => {
      // Handle joining group chat room
      socket.on('join group room', (data: { groupId: string; userId: string; username: string }) => {
        const { groupId, userId, username } = data;
        socket.join(groupId);
        console.log(`${username} joined group room: ${groupId}`);
      });

      // Handle leaving group chat room
      socket.on('leave group room', (data: { groupId: string; userId: string; username: string }) => {
        const { groupId, username } = data;
        socket.leave(groupId);
        console.log(`${username} left group room: ${groupId}`);
      });

      // Handle group message sending
      socket.on(
        'group message',
        async (data: {
          groupId: string;
          groupName: string;
          senderId: string;
          senderUsername: string;
          senderAvatarColor: string;
          senderProfilePicture: string;
          body: string;
          gifUrl: string;
          selectedImage: string;
          isRead: boolean;
          isGroupChat: boolean;
        }) => {
          const { groupId, senderId, senderUsername, senderAvatarColor, senderProfilePicture, body, gifUrl, selectedImage, isRead } = data;

          // Create message data
          const messageData: IMessageData = {
            _id: `${new mongoose.Types.ObjectId()}`,
            conversationId: undefined,
            receiverId: undefined,
            receiverUsername: undefined,
            receiverAvatarColor: undefined,
            receiverProfilePicture: undefined,
            senderUsername,
            senderId,
            senderAvatarColor,
            senderProfilePicture,
            body,
            isRead,
            gifUrl: gifUrl || '',
            selectedImage: selectedImage || '',
            reaction: [],
            createdAt: new Date(),
            deleteForMe: false,
            deleteForEveryone: false,
            isGroupChat: true,
            groupId
          };

          // Add message to cache
          await groupMessageCache.addGroupChatMessageToCache(groupId, messageData);

          // Add to database via queue
          chatQueue.addChatJob('addChatMessageToDB', messageData);

          // Emit message to group room
          this.io.to(groupId).emit('group message received', messageData);

          // Update group message list for all members
          const group = await groupMessageCache.getGroupChat(groupId);
          if (group && group.members && Array.isArray(group.members)) {
            for (const member of group.members) {
              if (member.state === 'accepted') {
                this.io.to(member.userId as string).emit('group chat list', group);
              }
            }
          }
        }
      );

      // Handle group message reactions
      // socket.on('group message reaction', async (data: {
      //   messageId: string;
      //   groupId: string;
      //   reaction: string;
      //   type: string;
      //   userId: string;
      //   username: string;
      // }) => {
      //   const { messageId, groupId, reaction, type, userId, username } = data;

      //   // Update message reaction in cache
      //   const updatedMessage = await groupMessageCache.updateMessageReaction(
      //     messageId,
      //     groupId,
      //     reaction,
      //     type,
      //     userId,
      //     username
      //   );

      //   if (updatedMessage) {
      //     this.io.to(groupId).emit('group message reaction', updatedMessage);
      //   }
      // });

      // Handle group actions
      socket.on('group action', async (data: { type: string; data: any }) => {
        const { type, data: actionData } = data;
        console.log('Group action:', type, actionData);
        switch (type) {
          case 'CREATE_GROUP':
            // Handled by controller, but we can emit additional event here if needed
            if (actionData) {
              this.io.emit('group action', {
                type: 'create',
                data: actionData
              });
            }
            break;

          case 'ACCEPT_GROUP_INVITATION':
            // Emit accept event to all relevant users
            if (actionData) {
              const group = await groupMessageCache.getGroupChat(actionData.groupId);
              if (group) {
                this.io.emit('group action', {
                  type: 'accept',
                  data: group
                });
              }
            }
            break;

          case 'UPDATE_GROUP':
            if (actionData) {
              this.io.emit('group action', {
                type: 'update',
                data: actionData
              });
              console.log('Group updated:', actionData);
            }
            break;

          case 'ADD_MEMBERS':
            if (actionData) {
              this.io.emit('group action', {
                type: 'update',
                data: actionData
              });
            }
            break;

          case 'REMOVE_MEMBER':
            // Emit remove event to all relevant users
            if (actionData) {
              this.io.emit('group action', {
                type: 'remove',
                data: {
                  groupId: actionData.groupId,
                  memberId: actionData.userId
                }
              });
            }
            break;

          case 'PROMOTE_ADMIN':
            // Emit promote event to all relevant users
            if (actionData) {
              const group = await groupMessageCache.getGroupChat(actionData.groupId);
              if (group) {
                this.io.emit('group action', {
                  type: 'promote',
                  data: group
                });
              }
            }
            break;

          case 'LEAVE_GROUP':
            // Emit leave event to all relevant users
            if (actionData) {
              const group = await groupMessageCache.getGroupChat(actionData.groupId);
              if (group) {
                this.io.emit('group action', {
                  type: 'leave',
                  data: group
                });
              }
            }
            break;

          case 'DELETE_GROUP':
            // Emit delete event to all relevant users
            if (actionData) {
              this.io.emit('group action', {
                type: 'delete',
                data: {
                  groupId: actionData.groupId
                }
              });
            }
            break;

          case 'READ_GROUP_MESSAGES':
            if (actionData && actionData.groupId && actionData.userId) {
              // If you implement this functionality later, uncomment below
              // await this.markGroupMessagesAsRead(actionData.groupId, actionData.userId);
              this.io.to(actionData.groupId).emit('group messages read', {
                groupId: actionData.groupId,
                userId: actionData.userId
              });
            }
            break;

          default:
            break;
        }
      });
    });
  }

  // private async markGroupMessagesAsRead(groupId: string, userId: string): Promise<void> {
  //   try {
  //     // Mark messages as read in cache
  //     await groupMessageCache.markMessagesAsRead(groupId, userId);

  //     // Queue job to update database
  //     chatQueue.addChatJob('markGroupMessagesAsReadInDB', {
  //       groupId,
  //       userId
  //     });
  //   } catch (error) {
  //     console.log('Error marking group messages as read', error);
  //   }
  // }
}
