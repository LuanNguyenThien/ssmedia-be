import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { config } from '@root/config';
import { CallHistoryCache } from './callhistory.cache';
import { CallStatus } from './callhistory.cache';

const callHistoryCache = new CallHistoryCache();
const log: Logger = config.createLogger('userStatusCache');

// Đơn giản hóa enum để tập trung vào trạng thái cuộc gọi
export enum UserCallStatus {
  IDLE = 'idle',      // Có thể nhận cuộc gọi
  BUSY = 'busy',      // Đang có cuộc gọi đến 
  IN_CALL = 'in_call' // Đã trong cuộc gọi
}

export interface UserCallInfo {
  callId: string;
  peerId: string;
  startTime: number;
  callType: 'audio' | 'video';
}

export class UserStatusCache extends BaseCache {
  constructor() {
    super('userCallStatus');
  }

  /**
   * Lấy trạng thái cuộc gọi hiện tại của người dùng
   */
  public async getUserCallStatus(userId: string): Promise<UserCallStatus> {
    try {
      const status = await this.client.get(`usercalls:${userId}:call_status`);
      return status as UserCallStatus || UserCallStatus.IDLE;
    } catch (error) {
      log.error(error);
      return UserCallStatus.IDLE;
    }
  }

  /**
   * Lấy thông tin cuộc gọi của người dùng
   */
  public async getUserCallInfo(userId: string): Promise<UserCallInfo | null> {
    try {
      const callInfoStr = await this.client.get(`usercalls:${userId}:call_info`);
      return callInfoStr ? JSON.parse(callInfoStr) : null;
    } catch (error) {
      log.error(error);
      return null;
    }
  }

  /**
   * Kiểm tra người dùng có thể nhận cuộc gọi hay không
   */
  public async canReceiveCall(userId: string, callerId: string): Promise<boolean> {
    try {
      const status = await this.getUserCallStatus(userId);
      console.log('User status:', status);
      if (status === UserCallStatus.IDLE && callerId !== userId) {
        return true;
      }
      if (status === UserCallStatus.BUSY || status === UserCallStatus.IN_CALL) {
        const callInfo = await this.getUserCallInfo(userId);
        
        // Nếu có thông tin cuộc gọi và người gọi trùng với người đang gọi, cho phép cuộc gọi
        if (callInfo && callInfo.peerId === callerId) {
          console.log('Allowing call from same caller:', callerId);
          return true;
        }
      }
      return false;
    } catch (error) {
      log.error(error);
      return false;
    }
  }

  /**
   * Xử lý người dùng bắt đầu cuộc gọi
   */
  public async startCall(
    callerId: string, 
    receiverId: string, 
    callId: string, 
    callType: 'audio' | 'video',
    callerName?: string,
    receiverName?: string
  ): Promise<boolean> {
    try {
      // Kiểm tra người nhận có thể nhận cuộc gọi không
      const canReceive = await this.canReceiveCall(receiverId, callerId);
      if (!canReceive) {
        return false;
      }

      // Bắt đầu transaction để cập nhật trạng thái cùng lúc cho cả hai người dùng
      const multi = this.client.multi();
      
      // Cập nhật trạng thái người gọi
      const callerInfo: UserCallInfo = {
        callId,
        peerId: receiverId,
        startTime: Date.now(),
        callType
      };
      
      // Cập nhật trạng thái người nhận
      const receiverInfo: UserCallInfo = {
        callId,
        peerId: callerId,
        startTime: Date.now(),
        callType
      };
      
      // Đặt trạng thái cuộc gọi
      multi.set(`usercalls:${callerId}:call_status`, UserCallStatus.IN_CALL);
      multi.set(`usercalls:${callerId}:call_info`, JSON.stringify(callerInfo));
      
      multi.set(`usercalls:${receiverId}:call_status`, UserCallStatus.BUSY);
      multi.set(`usercalls:${receiverId}:call_info`, JSON.stringify(receiverInfo));
      
      // Thực thi transaction
      await multi.exec();
      
      // Lưu thông tin cuộc gọi vào CallHistoryCache
      await callHistoryCache.saveCall({
        callId,
        callerId,
        receiverId,
        callerName,
        receiverName,
        callType,
        startTime: Date.now(),
        status: CallStatus.INITIATED
      });
      
      return true;
    } catch (error) {
      log.error(error);
      return false;
    }
  }

  /**
   * Xử lý khi người nhận cuộc gọi chấp nhận cuộc gọi
   */
  public async acceptCall(callId: string): Promise<void> {
    try {
      const call = await callHistoryCache.getCall(callId);
      if (!call) {
        throw new Error('Call not found');
      }
      
      const { receiverId } = call;
      
      // Cập nhật trạng thái người nhận thành IN_CALL
      await this.client.set(`usercalls:${receiverId}:call_status`, UserCallStatus.IN_CALL);
      
      // Cập nhật thông tin cuộc gọi
      await callHistoryCache.acceptCall(callId);
    } catch (error) {
      log.error(error);
    }
  }

  /**
   * Xử lý khi người nhận từ chối cuộc gọi
   */
  public async rejectCall(callId: string): Promise<void> {
    try {
      const call = await callHistoryCache.getCall(callId);
      if (!call) {
        return;
      }
      
      const { callerId, receiverId } = call;
      
      // Reset trạng thái của cả hai người dùng
      await this.resetUserCallStatus(callerId);
      await this.resetUserCallStatus(receiverId);
      
      // Cập nhật trạng thái cuộc gọi
      await callHistoryCache.rejectCall(callId);
      
      // Sau khi từ chối, tạo tin nhắn cho cuộc trò chuyện
      // await this.createCallMessage(call);
    } catch (error) {
      log.error(error);
    }
  }

  /**
   * Đánh dấu cuộc gọi bị nhỡ
   */
  public async missedCall(callId: string): Promise<void> {
    try {
      const call = await callHistoryCache.getCall(callId);
      if (!call) {
        return;
      }
      
      const { callerId, receiverId } = call;
      
      // Reset trạng thái của cả hai người dùng
      await this.resetUserCallStatus(callerId);
      await this.resetUserCallStatus(receiverId);
      
      // Cập nhật trạng thái cuộc gọi
      await callHistoryCache.missedCall(callId);
      
      // Tạo tin nhắn cho cuộc trò chuyện
      // await this.createCallMessage(call);
    } catch (error) {
      log.error(error);
    }
  }

  /**
   * Kết thúc cuộc gọi
   */
  public async endCall(callId: string, endedBy: string): Promise<void> {
    try {
      const call = await callHistoryCache.getCall(callId);
      if (!call) {
        return;
      }
      
      const { callerId, receiverId, answeredAt } = call;

      if(!answeredAt) {
        // Nếu cuộc gọi chưa được trả lời, đánh dấu là cuộc gọi nhỡ
        await this.missedCall(callId);
        return;
      }
      
      // Reset trạng thái của cả hai người dùng
      await this.resetUserCallStatus(callerId);
      await this.resetUserCallStatus(receiverId);
      
      // Cập nhật trạng thái cuộc gọi
      await callHistoryCache.endCall(callId, endedBy);
      
      // Tạo tin nhắn cho cuộc trò chuyện
      // await this.createCallMessage(call);
    } catch (error) {
      log.error(error);
    }
  }

  /**
   * Reset trạng thái của người dùng sau cuộc gọi
   */
  private async resetUserCallStatus(userId: string): Promise<void> {
    try {
      await this.client.set(`usercalls:${userId}:call_status`, UserCallStatus.IDLE);
      await this.client.del(`usercalls:${userId}:call_info`);
    } catch (error) {
      log.error(error);
    }
  }

  /**
   * Thiết lập timeout cho cuộc gọi (tự động hủy nếu không được trả lời)
   */
  public async setupCallTimeout(callId: string, timeoutInSeconds: number = 30): Promise<void> {
    try {
      await this.client.set(`calls:${callId}:timeout`, 'pending', {
        EX: timeoutInSeconds
      });
    } catch (error) {
      log.error(error);
    }
  }

  /**
   * Lấy socket ID của người dùng (từ bảng ánh xạ do socket setup tạo)
   */
  public async getUserSocketId(userId: string): Promise<string | null> {
    try {
      return await this.client.get(`socket:${userId}`);
    } catch (error) {
      log.error(error);
      return null;
    }
  }

  /**
   * Tạo tin nhắn từ thông tin cuộc gọi
   */
  // private async createCallMessage(call: any): Promise<void> {
  //   try {
  //     const { callId, callerId, receiverId, callType } = call;
      
  //     // Lấy thông tin cuộc gọi đã cập nhật
  //     const updatedCall = await callHistoryCache.getCall(callId);
  //     if (!updatedCall) return;
      
  //     let messageContent = '';
  //     const messageType = 'call_log';
      
  //     // Tạo nội dung tin nhắn dựa trên trạng thái cuộc gọi
  //     switch (updatedCall.status) {
  //       case 'missed':
  //         messageContent = `Cuộc gọi ${callType === 'video' ? 'video' : 'thoại'} nhỡ`;
  //         break;
  //       case 'rejected':
  //         messageContent = `Cuộc gọi ${callType === 'video' ? 'video' : 'thoại'} bị từ chối`;
  //         break;
  //       case 'ended':
  //         const duration = updatedCall.duration || 0;
  //         const minutes = Math.floor(duration / 60);
  //         const seconds = duration % 60;
  //         const durationText = minutes > 0 ? 
  //           `${minutes} phút ${seconds} giây` : 
  //           `${seconds} giây`;
  //         messageContent = `Cuộc gọi ${callType === 'video' ? 'video' : 'thoại'} (${durationText})`;
  //         break;
  //       default:
  //         messageContent = `Cuộc gọi ${callType === 'video' ? 'video' : 'thoại'}`;
  //     }
      
  //     // Tạo dữ liệu tin nhắn
  //     const messageData = {
  //       senderId: callerId,
  //       receiverId: receiverId,
  //       conversationId: `${callerId}-${receiverId}`,
  //       body: messageContent,
  //       messageType,
  //       callId,
  //       callType,
  //       callStatus: updatedCall.status,
  //       duration: updatedCall.duration || 0,
  //       createdAt: Date.now()
  //     };
      
  //     // Lưu tin nhắn bằng MessageCache
  //     await cache.messageCache.addMessageToChatList(messageData);
  //   } catch (error) {
  //     log.error(error);
  //   }
  // }
}