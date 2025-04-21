import { ISenderReceiver } from '@chat/interfaces/chat.interface';
import { Server, Socket } from 'socket.io';
import { connectedUsersMap } from './user';

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

      socket.on('call-user', (data: { userToCall: string, signal: any, callType: string, callerName: string }) => {
        const { userToCall, signal, callType, callerName } = data;
        console.log(data);
        const senderSocketId: string = connectedUsersMap.get(socket.id) as string;
        const receiverSocketId: string = connectedUsersMap.get(userToCall) as string;
        if (!receiverSocketId) {
          console.log(`Receiver with ID ${userToCall} is not connected.`);
          socket.emit('call-rejected', { message: 'User is offline' });
          return;
        }
        //Kiểm tra trạng thái người nhận cuộc gọi
        //Đặt trạng thái cuộc gọi cho người nhận
        this.io.to(receiverSocketId).emit('call-incoming', { signal, from: senderSocketId, callType, callerName });
      });

      socket.on('call-accepted', (data: { signal: any, to: string, callType: string }) => {
        const { signal, to, callType } = data;
        console.log(data);
        const senderSocketId: string = connectedUsersMap.get(socket.id) as string;
        const receiverSocketId: string = connectedUsersMap.get(to) as string;
        this.io.to(receiverSocketId).emit('call-accepted', { signal, callType, from: senderSocketId });
      });

      socket.on('call-rejected', (data: { to: string }) => {
        const { to } = data;
        console.log(data);
        const senderSocketId: string = connectedUsersMap.get(socket.id) as string;
        const receiverSocketId: string = connectedUsersMap.get(to) as string;
        this.io.to(receiverSocketId).emit('call-rejected', { from: senderSocketId });
      });

      socket.on('call-ended', (data: { to: string }) => {
        const { to } = data;
        console.log(data);
        const senderSocketId: string = connectedUsersMap.get(socket.id) as string;
        const receiverSocketId: string = connectedUsersMap.get(to) as string;
        if(!receiverSocketId) {
          return;
        }
        console.log(`Receiver socket ID: ${receiverSocketId}`);
        this.io.to(receiverSocketId).emit('call-ended', { from: senderSocketId });
      });

      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
      });
    });
  }
}
