import { ILogin, ISocketData } from '@user/interfaces/user.interface';
import { Server, Socket } from 'socket.io';

export let socketIOUserObject: Server;
export const connectedUsersMap: Map<string, string> = new Map();
let users: string[] = [];

export class SocketIOUserHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    socketIOUserObject = io;
  }

  public listen(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log('User socket connected', socket.id);
      socket.on('setup', (data: ILogin) => {
        data.userId = data.userId.toString().toLowerCase();
        console.log('User socket setup', data.userId);
        this.addClientToMap(data.userId, socket.id);
        console.log('users', users);
        this.addUser(data.userId);
        this.io.emit('user online', users);
      });

      socket.on('block user', (data: ISocketData) => {
        this.io.emit('blocked user id', data);
      });

      socket.on('unblock user', (data: ISocketData) => {
        this.io.emit('unblocked user id', data);
      });

      socket.on('disconnect', () => {
        this.removeClientFromMap(socket.id);
      });
    });
  }

  private addClientToMap(username: string, socketId: string): void {
    if (!connectedUsersMap.has(username)) {
      connectedUsersMap.set(username, socketId);
    }
  }

  private removeClientFromMap(socketId: string): void {
    if (Array.from(connectedUsersMap.values()).includes(socketId)) {
      const disconnectedUser: [string, string] = [...connectedUsersMap].find((user: [string, string]) => {
        return user[1] === socketId;
      }) as [string, string];
      connectedUsersMap.delete(disconnectedUser[0]);
      this.removeUser(disconnectedUser[0]);
      this.io.emit('user online', users);
    }
  }

  private addUser(username: string): void {
    users.push(username);
    users = [...new Set(users)];
  }

  private removeUser(username: string): void {
    users = users.filter((name: string) => name != username);
  }
}
