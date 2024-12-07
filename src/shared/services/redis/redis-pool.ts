import Redis from 'ioredis';
import { createPool, Factory } from 'generic-pool';

// Factory tạo Redis client
const redisFactory: Factory<Redis> = {
  create: () => Promise.resolve(new Redis(process.env.REDIS_HOST || 'redis://localhost:6379')),

  destroy: async (client: Redis) => {
    await client.quit(); // `client.quit()` trả về Promise<string>
    return Promise.resolve(); // Trả về Promise<void> để khớp với yêu cầu của generic-pool
  },
};

// Tạo pool với giới hạn kết nối Redis
const redisPool = createPool(redisFactory, {
  max: 10, // Số lượng kết nối tối đa
  min: 2,  // Số lượng kết nối tối thiểu
  idleTimeoutMillis: 30000, // Thời gian tối đa một client có thể idle
  acquireTimeoutMillis: 10000, // Thời gian đợi để lấy client từ pool
});

// Hàm lấy client từ pool
export const getRedisClient = async (): Promise<Redis> => {
  return await redisPool.acquire();
};

// Trả lại client vào pool sau khi dùng
export const releaseRedisClient = async (client: Redis) => {
  await redisPool.release(client);
};
