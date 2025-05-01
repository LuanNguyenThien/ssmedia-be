import { IMediaProcessingJob } from '@post/interfaces/post-media.interface';
import { BaseQueue } from '@service/queues/base.queue';
import { mediaWorker } from '@worker/media.worker';
import { JobOptions, Job } from 'bull';

class MediaQueue extends BaseQueue {
  constructor() {
    super('media');
    this.processJob('processPostMedia', 5, mediaWorker.processMedia);
  }

  public addMediaJob(name: string, data: IMediaProcessingJob, options?: JobOptions): Promise<Job> {
    return this.addJob(name, data, options);
  }
}

export const mediaQueue = new MediaQueue();