import * as Redis from 'ioredis';
import { config } from '@root/config';
import Logger from 'bunyan';

class RedisService {
  private static instance: RedisService;
  private redisClient: Redis.Redis;
  private subcriberClient: Redis.Redis;
  private bclient: Redis.Redis;
  private log: Logger;
  private isConnected: boolean = false;
  private connectPromise: Promise<void> | null = null;

  private constructor() {
    this.log = config.createLogger('redisService');
    console.log('Creating RedisService instance');
    const redisHost = config.REDIS_HOST || 'redis://localhost:6379';
    this.redisClient = new Redis.default(redisHost);
    this.subcriberClient = new Redis.default(redisHost, {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
    this.bclient = new Redis.default(redisHost, {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,});

    // Thêm handler cho sự kiện error
    this.redisClient.on('error', (error) => {
      this.log.error(`Redis error: ${error}`);
    });
    this.subcriberClient.on('error', (error) => {
      this.log.error(`Redis subscriber error: ${error}`);
    });
    this.bclient.on('error', (error) => {
      this.log.error(`Redis bclient error: ${error}`);
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
        this.connectPromise = this.redisClient.connect().then(() => {
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
      await this.redisClient.quit();
      this.isConnected = false;
      this.log.info('Redis disconnected successfully');
    }
  }

  getredisClient(): Redis.Redis {
    return this.redisClient;
  }

  getsubcriberClient(): Redis.Redis {
    return this.subcriberClient;
  }

  getbclient(): Redis.Redis {
    return this.bclient;
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }
}

export const redisService = RedisService.getInstance();