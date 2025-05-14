import Queue, { Job, JobOptions } from 'bull';
import Logger from 'bunyan';
import { ExpressAdapter, createBullBoard, BullAdapter } from '@bull-board/express';
import { config } from '@root/config';
import { IGroupChat, IGroupChatDocument, IGroupChatJob } from '@root/features/group-chat/interfaces/group-chat.interface';
import { IFavPostDocument } from '@favorite-posts/interfaces/fav-post.interface';
import { IAuthJob } from '@auth/interfaces/auth.interface';
import { IEmailJob, IUserJob } from '@user/interfaces/user.interface';
import { IPostJobData } from '@post/interfaces/post.interface';
import { IReactionJob } from '@reaction/interfaces/reaction.interface';
import { ICommentJob } from '@comment/interfaces/comment.interface';
import { IBlockedUserJobData, IFollowerJobData } from '@follower/interfaces/follower.interface';
import { INotificationJobData } from '@notification/interfaces/notification.interface';
import { IFileImageJobData } from '@image/interfaces/image.interface';
import { IChatJobData, IMessageData } from '@chat/interfaces/chat.interface';
import { IMediaProcessingJob } from '@post/interfaces/post-media.interface';
// import { redisService } from '@service/redis/redis.service';
// import RedisManager from '@service/redis/redis.service';
// import { getRedisClient, releaseRedisClient } from '@service/redis/redis-pool';

type IBaseJobData =
  | IAuthJob
  | IEmailJob
  | IPostJobData
  | IReactionJob
  | ICommentJob
  | IFollowerJobData
  | IBlockedUserJobData
  | INotificationJobData
  | IFileImageJobData
  | IChatJobData
  | IMessageData
  | IUserJob
  | IFavPostDocument
  | IGroupChatJob
  | IGroupChat
  | IGroupChatDocument
  | IMediaProcessingJob;

let bullAdapters: BullAdapter[] = [];
export let serverAdapter: ExpressAdapter;
// const redisClient = redisService.getredisClient();
// const subcriberClient = redisService.getsubcriberClient();
// const bclient = redisService.getbclient();

// const redisClient = redisPool.getClient();
// const subscriberClient = redisPool.getClient();
// const bclient = redisPool.getClient();

export abstract class BaseQueue {
  queue: Queue.Queue;
  log: Logger;

  // constructor(queueName: string) {
  //   this.queue = new Queue(queueName, `${config.REDIS_HOST}`); // Khởi tạo với giá trị mặc định
  //   this.log = config.createLogger(`${queueName}Queue`); // Khởi tạo với giá trị mặc định

  //   this.initializeQueue(queueName);
  // }

  // private async initializeQueue(queueName: string): Promise<void> {
  //   try {
  //     const redisClient = redisService.getClient();

  //     // if (!redisService.isClientConnected() && queueName === 'auth') {
  //     //   console.log('Redis client is not connected, attempting to connect...');
  //     //   await redisClient.connect();
  //     //   console.log('Redis client connected successfully');
  //     // }

  //     await this.createQueue(queueName, redisClient);
  //   } catch (error) {
  //     console.error(`Failed to create queue ${queueName}:`, error);
  //   }
  // }

  // private async createQueue(queueName: string, redisClient: any): Promise<void> {
  //   return new Promise<void>(async (resolve, reject) => {
  //       try {
  //         if (redisClient.status === 'ready') {
  //           console.log('Redis client is not connected, attempting to connect...');
  //         }
  //           if (queueName === "test") {
  //               if (redisClient.status === 'ready') {
  //                   console.log('Redis client is connected successfully');
  //                   this.queue = new Queue(queueName, {
  //                       createClient: (type) => {
  //                           switch (type) {
  //                               case 'client':
  //                                   return redisClient;
  //                               case 'subscriber':
  //                                   return redisClient.duplicate();
  //                               default:
  //                                   return redisClient;
  //                           }
  //                       },
  //                   });
  //               }
  //           }
  //           bullAdapters.push(new BullAdapter(this.queue));
  //           bullAdapters = [...new Set(bullAdapters)];
  //           serverAdapter = new ExpressAdapter();
  //           serverAdapter.setBasePath('/queues');

  //           createBullBoard({
  //               queues: bullAdapters,
  //               serverAdapter
  //           });

  //           this.log = config.createLogger(`${queueName}Queue`);

  //           this.queue.on('ready', () => {
  //               console.log(`Queue ${queueName} is ready to process jobs`);
  //               resolve(); // Resolve Promise khi queue đã sẵn sàng
  //           });

  //           this.queue.on('error', (error) => {
  //               console.error(`Error in queue ${queueName}:`, error);
  //               reject(error); // Reject Promise nếu có lỗi
  //           });

  //           this.queue.on('completed', (job: Job) => {
  //               job.remove();
  //           });

  //           this.queue.on('global:completed', (jobId: string) => {
  //               this.log.info(`Job ${jobId} completed`);
  //           });

  //           this.queue.on('global:stalled', (jobId: string) => {
  //               this.log.info(`Job ${jobId} is stalled`);
  //           });
  //       } catch (error) {
  //           reject(error); // Reject Promise nếu có lỗi
  //       }
  //   });
  // }


  constructor(queueName: string) {
    this.log = config.createLogger(`${queueName}Queue`);

    // this.queue = new Queue(queueName, {
    //   createClient: (type) => {
    //     switch (type) {
    //       case 'client':
    //         return RedisManager.getClient();
    //       case 'subscriber':
    //         return RedisManager.getSubscriber();
    //       case 'bclient':
    //         return RedisManager.getBClient();
    //       default:
    //         throw new Error(`Unexpected client type: ${type}`);
    //     }
    //   },
    // });

    // this.queue = new Queue(queueName, {
    //   createClient: (type) => {
    //     switch (type) {
    //       case 'client':
    //         return redisClients.getClient();
    //       case 'subscriber':
    //         return redisClients.getSubscriber();
    //       case 'bclient':
    //         return redisClients.getBclient();
    //       default:
    //         throw new Error(`Unexpected connection type: ${type}`);
    //     }
    //   },
    // });


    // this.queue = new Queue(queueName, {
    //   createClient: async (type: string) => {
    //     const client = await getRedisClient(); // Lấy client từ pool
    //     if (type === 'client' || type === 'subscriber' || type === 'bclient') {
    //       return client;
    //     } else {
    //       throw new Error(`Unexpected client type: ${type}`);
    //     }
    //   },
    // });


    // this.queue = new Queue(queueName, {
    //   createClient: (type) => {
    //     switch (type) {
    //       case 'client':
    //         return redisClient;
    //       case 'subscriber':
    //         return subcriberClient;
    //       case 'bclient':
    //         return bclient;
    //       default:
    //         throw new Error(`Unexpected connection type: ${type}`);
    //     }
    //   },
    // });


    this.queue = new Queue(queueName, `${config.REDIS_HOST_Queue}`);
    // if (!redisClient.isOpen) {
    //   console.error('Redis client is not connected');
    //   throw new Error('Redis client is not connected');
    // }
    // // Lấy thông tin kết nối
    // const connectionInfo = redisClient.options;
    // // Kiểm tra xem connectionInfo có tồn tại không
    // let host = 'localhost';
    // let port = '6379';

    // try {
    //     if (connectionInfo && connectionInfo.url) {
    //         const url = new URL(connectionInfo.url);
    //         host = url.hostname;
    //         port = url.port || '6379'; // Mặc định là 6379 nếu không có port
    //     }
    // } catch (error) {
    //     console.error('Error parsing Redis connection info:', error);
    // }

    // // Log thông tin kết nối
    // console.log(`Using Redis client connected to: ${host}:${port}`);
    // this.queue = new Queue(queueName, {
    //   redis: {
    //     client: redisClient,
    //   }
    // } as QueueOptions);

    console.log(`Queue ${queueName} has been created`);
  
    bullAdapters.push(new BullAdapter(this.queue));
    bullAdapters = [...new Set(bullAdapters)];
    serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/queues');
  
    createBullBoard({
      queues: bullAdapters,
      serverAdapter
    });
  
    this.log = config.createLogger(`${queueName}Queue`);
  
    this.queue.on('ready', () => {
      console.log(`Queue ${queueName} is ready to process jobs`);
    });
  
    this.queue.on('error', (error) => {
      console.error(`Error in queue ${queueName}:`, error);
    });

    this.queue.on('failed', (job, err) => {
      console.error(`Job failed: ${job.id}, Error: ${err.message}`);
    });
  
    this.queue.on('completed', (job: Job) => {
      job.remove();
    });
  
    this.queue.on('global:completed', (jobId: string) => {
      this.log.info(`Job ${jobId} completed`);
    });
  
    this.queue.on('global:stalled', (jobId: string) => {
      this.log.info(`Job ${jobId} is stalled`);
    });
  }

  protected async addJob(name: string, data: IBaseJobData, options?: JobOptions): Promise<Job> {
    // Các tùy chọn mặc định
    const defaultOptions: JobOptions = {
      attempts: 3,
      backoff: { type: 'fixed', delay: 5000 }
    };
  
    // Hợp nhất options từ người dùng với options mặc định
    // options từ người dùng sẽ ghi đè lên options mặc định nếu cùng key
    const mergedOptions: JobOptions = { ...defaultOptions, ...options };
  
    // Thêm job vào queue và trả về job instance
    const job = await this.queue.add(name, data, mergedOptions);
    return job;
  }

  protected processJob(name: string, concurrency: number, callback: Queue.ProcessCallbackFunction<void>): void {
    this.queue.process(name, concurrency, callback);
  }

  // protected processJob(
  //   name: string,
  //   concurrency: number,
  //   callback: (job: Job, done: (error?: Error | null) => void) => void
  // ): void {
  //   this.queue.process(name, concurrency, (job, done) => {
  //     try {
  //       // Gọi callback với job và done
  //       callback(job, done);
  //     } catch (error) {
  //       console.error(`Error processing job ${job.id}:`, error);
  //       done(error as Error); // Gọi done với lỗi nếu có
  //     }
  //   });
  // }
}
