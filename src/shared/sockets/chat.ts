import { ISenderReceiver } from '@chat/interfaces/chat.interface';
import { Server, Socket } from 'socket.io';
import { connectedUsersMap } from './user';
import { cache } from '@service/redis/cache';

export let socketIOChatObject: Server;

export class SocketIOChatHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    socketIOChatObject = io;
  }

  public listen(): void {
    this.io.on('connection', (socket: Socket) => {
      socket.on('join room', (users: ISenderReceiver) => {
        const { roomId } = users;
        // const senderSocketId: string = connectedUsersMap.get(senderId) as string;
        // const receiverSocketId: string = connectedUsersMap.get(receiverId) as string;
        socket.join(roomId);
        // socket.join(receiverSocketId);
      });

      socket.on('call-user', async (data: { userToCall: string, signal: any, callType: string, callerName: string, callId: string }) => {
        const { userToCall, signal, callType, callerName, callId } = data;
        try{
          console.log(data);
          const senderSocketId: string = connectedUsersMap.get(callerName.toLowerCase()) as string;
          console.log(connectedUsersMap);
          const receiverSocketId: string = connectedUsersMap.get(userToCall) as string;
          // if (!receiverSocketId) {
          //   console.log(`Receiver with ID ${userToCall} is not connected.`);
          //   socket.emit('call-rejected', { message: 'User is offline' });
          //   return;
          // }
          //Kiểm tra trạng thái người nhận cuộc gọi
          const canReceiveCall = await cache.userStatusCache.canReceiveCall(userToCall, callerName.toLowerCase());
          console.log(canReceiveCall);
          if (!canReceiveCall) {
            this.io.to(senderSocketId).emit('call-busy', { 
              userId: userToCall,
              message: 'User is busy with another call'
            });
            return;
          }
          // Bắt đầu cuộc gọi trong cache
          const callStarted = await cache.userStatusCache.startCall(
            callerName.toLowerCase(),
            userToCall,
            callId,
            callType === 'video' ? 'video' : 'audio',
            callerName.toLowerCase(),
            userToCall
          );
          if(callStarted) {
            if(receiverSocketId) {
              //Đặt trạng thái cuộc gọi cho người nhận
              this.io.to(receiverSocketId).emit('call-incoming', { signal, from: senderSocketId, callType, callerName, callId });
            }
          }
        }catch (error) {
          console.error('Error in call-user event:', error);
          socket.emit('call-rejected', { message: 'An error occurred while processing the call.' });
        }
      });

      socket.on('call-accepted', async(data: { signal: any, to: string, callType: string, callId: string }) => {
        const { signal, to, callType, callId } = data;
        console.log(data);
        const senderSocketId: string = connectedUsersMap.get(socket.id) as string;
        const receiverSocketId: string = connectedUsersMap.get(to) as string;
        try {
          if(receiverSocketId) {
            console.log(`Receiver socket ID: ${receiverSocketId}`);
            this.io.to(receiverSocketId).emit('call-accepted', { signal, callType, from: senderSocketId, callId });
          }
          // Cập nhật trạng thái cuộc gọi trong cache
          await cache.userStatusCache.acceptCall(callId);
        } catch (error) {
          console.error('Error accepting call:', error);
        }
        // this.io.to(receiverSocketId).emit('call-accepted', { signal, callType, from: senderSocketId, callId });
      });

      socket.on('call-rejected', async (data: { to: string, callId: string }) => {
        const { to, callId } = data;
        console.log(data);
        const senderSocketId: string = connectedUsersMap.get(socket.id) as string;
        const receiverSocketId: string = connectedUsersMap.get(to) as string;
        try {
          if(receiverSocketId) {
            this.io.to(receiverSocketId).emit('call-ended', { from: senderSocketId });
          }
          await new Promise<void>((resolve) => {
            setTimeout(async () => {
              await cache.userStatusCache.rejectCall(callId);
              resolve();
            }, 800);
          });
        } catch (error) {
          console.error('Error rejecting call:', error);
        }
        // this.io.to(receiverSocketId).emit('call-rejected', { from: senderSocketId });
      });

      socket.on('call-ended', async (data: { to: string, callId: string }) => {
        const { to, callId } = data;
        console.log(data);
        const senderSocketId: string = connectedUsersMap.get(socket.id) as string;
        const receiverSocketId: string = connectedUsersMap.get(to) as string;
        try {
          if(receiverSocketId) {
            console.log(`Receiver socket ID: ${receiverSocketId}`);
            this.io.to(receiverSocketId).emit('call-ended', { from: senderSocketId });
          }
          await cache.userStatusCache.endCall(callId, receiverSocketId);
        } catch (error) {
          console.error('Error ending call:', error);
        }
      });

      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
      });
    });
  }
}
