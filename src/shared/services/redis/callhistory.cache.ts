import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { config } from '@root/config';

const log: Logger = config.createLogger('callHistoryCache');

export enum CallStatus {
  INITIATED = 'initiated',  // Bắt đầu cuộc gọi
  ACTIVE = 'active',        // Cuộc gọi được chấp nhận
  ENDED = 'ended',          // Cuộc gọi kết thúc bình thường
  MISSED = 'missed',        // Cuộc gọi không được trả lời
  REJECTED = 'rejected'     // Cuộc gọi bị từ chối
}

export interface ICallLog {
  conversationId?: string;
  callId: string;
  callerId: string;
  receiverId: string;
  callerName?: string;
  callerAvatarColor?: string;
  callerAvatarSrc?: string;
  receiverName?: string;
  receiverAvatarColor?: string;
  receiverAvatarSrc?: string;
  callType: 'audio' | 'video';
  startTime: number;
  answeredAt?: number;
  endedAt?: number;
  duration?: number;
  status: CallStatus;
  endedBy?: string;
}

export class CallHistoryCache extends BaseCache {
  constructor() {
    super('callHistory');
  }

  /**
   * Lưu thông tin cuộc gọi mới
   */
  public async saveCall(callData: ICallLog): Promise<void> {
    try {
      const { callId, callerId, receiverId } = callData;
      
      // Lưu thông tin chi tiết cuộc gọi
      await this.client.set(`calls:${callId}`, JSON.stringify(callData));
      
      // Thêm vào danh sách lịch sử của cả người gọi và người nhận
      await this.client.lPush(`usercalls:${callerId}:calls`, callId);
      await this.client.lPush(`usercalls:${receiverId}:calls`, callId);

      // Đặt thời gian hết hạn (ví dụ: 30 ngày)
      await this.client.expire(`calls:${callId}`, 60 * 60 * 24 * 30);
    } catch (error) {
      log.error(error);
      throw new Error('Error saving call data');
    }
  }

  /**
   * Cập nhật thông tin cuộc gọi
   */
  public async updateCall(callId: string, updates: Partial<ICallLog>): Promise<ICallLog | null> {
    try {
      const callData = await this.getCall(callId);
      if (!callData) return null;

      // Cập nhật thông tin mới
      const updatedCall = {
        ...callData,
        ...updates
      };

      await this.client.set(`calls:${callId}`, JSON.stringify(updatedCall));
      return updatedCall;
    } catch (error) {
      log.error(error);
      throw new Error('Error updating call');
    }
  }

  /**
   * Lấy thông tin cuộc gọi theo ID
   */
  public async getCall(callId: string): Promise<ICallLog | null> {
    try {
      const call = await this.client.get(`calls:${callId}`);
      return call ? JSON.parse(call) : null;
    } catch (error) {
      log.error(error);
      throw new Error('Error getting call');
    }
  }

  /**
   * Cập nhật khi cuộc gọi được chấp nhận
   */
  public async acceptCall(callId: string): Promise<ICallLog | null> {
    const now = Date.now();
    return this.updateCall(callId, {
      status: CallStatus.ACTIVE,
      answeredAt: now
    });
  }

  /**
   * Cập nhật khi cuộc gọi bị nhỡ
   */
  public async missedCall(callId: string): Promise<ICallLog | null> {
    const now = Date.now();
    return this.updateCall(callId, {
      status: CallStatus.MISSED,
      endedAt: now
    });
  }

  /**
   * Cập nhật khi cuộc gọi bị từ chối
   */
  public async rejectCall(callId: string): Promise<ICallLog | null> {
    const now = Date.now();
    return this.updateCall(callId, {
      status: CallStatus.REJECTED,
      endedAt: now
    });
  }

  /**
   * Cập nhật khi cuộc gọi kết thúc
   */
  public async endCall(callId: string, endedBy: string): Promise<ICallLog | null> {
    const now = Date.now();
    const call = await this.getCall(callId);
    if (!call) return null;

    let duration = 0;
    if (call.answeredAt) {
      duration = Math.floor((now - call.answeredAt) / 1000); // Đổi từ ms sang giây
    }

    return this.updateCall(callId, {
      status: CallStatus.ENDED,
      endedAt: now,
      endedBy,
      duration
    });
  }

  /**
   * Lấy lịch sử cuộc gọi của một người dùng
   */
  public async getUserCallHistory(userId: string, limit: number = 20): Promise<ICallLog[]> {
    try {
      const callIds = await this.client.lRange(`usercalls:${userId}:calls`, 0, limit - 1);
      
      if (!callIds.length) return [];
      
      const calls: ICallLog[] = [];
      for (const callId of callIds) {
        const call = await this.getCall(callId);
        if (call) {
          calls.push(call);
        }
      }
      
      // Sắp xếp theo thời gian mới nhất
      return calls.sort((a, b) => {
        const timeA = a.endedAt || a.startTime;
        const timeB = b.endedAt || b.startTime;
        return timeB - timeA;
      });
    } catch (error) {
      log.error(error);
      return [];
    }
  }
}