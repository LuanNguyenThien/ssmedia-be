import { createClient } from 'redis';
import { config } from '@root/config';
import Logger from 'bunyan';

class RedisService {
  private static instance: RedisService;
  private client: ReturnType<typeof createClient>;
  private log: Logger;
  private isConnected: boolean = false;
  private connectPromise: Promise<void> | null = null;

  private constructor() {
    this.log = config.createLogger('redisService');
    console.log('Creating RedisService instance');
    this.client = createClient({
      url: config.REDIS_HOST,
      legacyMode: true
    });

    // Thêm handler cho sự kiện error
    this.client.on('error', (error) => {
      this.log.error(`Redis error: ${error}`);
    });
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      if (!this.connectPromise) {
        this.connectPromise = this.client.connect().then(() => {
          this.isConnected = true;
          this.log.info('Redis connected successfully');
        }).catch((error) => {
          this.log.error('Error connecting to Redis:', error);
          this.connectPromise = null; // Reset promise nếu có lỗi
        });
      }
      await this.connectPromise; // Chờ cho đến khi kết nối hoàn tất
    } else {
      this.log.info('Redis is already connected');
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      this.log.info('Redis disconnected successfully');
    }
  }

  getClient(): ReturnType<typeof createClient> {
    return this.client;
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }
}

export const redisService = RedisService.getInstance();