import { createClient, RedisClientType } from 'redis';
import Logger from 'bunyan';
import { config } from '@root/config';
// import { redisService } from '@service/redis/redis.service';

export type RedisClient = RedisClientType;

export abstract class BaseCache {
  private static clientInstance: RedisClient | null = null;
  client: RedisClient;
  log: Logger;

  constructor(cacheName: string) {
    console.log(cacheName);
    if(cacheName === 'callHistory' || cacheName === 'userCallStatus') {
      this.client = createClient({ url: config.REDIS_HOST });
      this.client.connect().catch((error) => {
        console.error('Failed to connect to Redis:', error);
      });
    }else {
    // this.client = createClient({ url: config.REDIS_HOST });
      this.client = BaseCache.getClient();
    }
    // redisService.connect();
    // this.client = redisService.getredisClient();
    this.log = config.createLogger(cacheName);
    this.cacheError();
  }

  private static getClient(): RedisClient {
    if (!BaseCache.clientInstance) {
      console.log('Creating new Redis client');
      BaseCache.clientInstance = createClient({ url: config.REDIS_HOST });

      // Kết nối Redis ngay khi khởi tạo
      BaseCache.clientInstance.connect().catch((error) => {
        console.error('Failed to connect to Redis:', error);
      });
    }
    return BaseCache.clientInstance;
  }

  private cacheError(): void {
    this.client.on('error', (error: unknown) => {
      this.log.error(error);
    });
  }
}
