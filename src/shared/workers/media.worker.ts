import { DoneCallback, Job } from 'bull';
import { IMediaProcessingJob } from '@post/interfaces/post-media.interface';
import { mediaService } from '@service/media/media.service';
import { cache } from '@service/redis/cache';
import { PostModel } from '@post/models/post.schema';

class MediaWorker {
  public async processMedia(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { postId, htmlPost, userId } = job.data;
      
      // Process media in HTML content
      const processedMedia = await mediaService.processHtmlMedia(postId, htmlPost);
      
      // Update post với phương thức updateOne - không cần chuyển đổi kiểu
      const updateResult = await PostModel.updateOne(
        { _id: postId },
        { $set: { htmlPost: processedMedia.htmlContent } }
      );
      
      if (updateResult.modifiedCount > 0) {
        // Update post in cache
        await cache.postCache.updatePostPropertyInCache(
          postId.toString(),
          'htmlPost',
          processedMedia.htmlContent
        );
      } else {
        console.warn(`No document was updated for post ${postId}`);
      }
      
      done(null, job.data);
    } catch (error) {
      console.error('Error in media processing job:', error);
      done(error as Error);
    }
  }
}

export const mediaWorker = new MediaWorker();