import { Job, DoneCallback } from 'bull';
import Logger from 'bunyan';
import { config } from '@root/config';
import { postService } from '@service/db/post.service';
import { socketIONotificationObject } from '@socket/notification';
import axios from 'axios';
import { Update } from '@post/controllers/update-post';
import { IPostDocument } from '@post/interfaces/post.interface';

const log: Logger = config.createLogger('postWorker');

class PostWorker {
  public async analyzePostContent(job: Job, done: DoneCallback): Promise<void> {
    console.log('Job Data: ', job.data);
    const { value } = job.data;

    try {
      const response = await axios.post('http://localhost:8000/analyze', { value });
      const analysisResult = JSON.parse(response.data);

      job.progress(100);
      done(null, job.data);

      const educationalValue = analysisResult['Educational Value'];
      const relevanceToLearningCommunity = analysisResult['Relevance to Learning Community'];

      // Log các giá trị để kiểm tra
      console.log('Educational Value:', educationalValue);
      console.log('Relevance to Learning Community:', relevanceToLearningCommunity);

      if (typeof educationalValue === 'undefined' || typeof relevanceToLearningCommunity === 'undefined') {
        console.error('Missing expected fields in analysis result:', analysisResult);
        return;
      }

      if (educationalValue < 3 || relevanceToLearningCommunity < 3) {
        // Xử lý khi nội dung không phù hợp
        const message = 'Bài viết của bạn vào lúc '+ value.createdAt+ ' có nội dung không phù hợp, vui lòng chỉnh sửa lại!';
        console.log(value.userId);
        socketIONotificationObject.emit('post analysis', message, {userId: value.userId} );

        const updatedPost: IPostDocument = {
          post: value.post,
          bgColor: value.bgColor,
          privacy: 'Private', // Cập nhật quyền riêng tư thành 'private'
          feelings: value.feelings,
          gifUrl: value.gifUrl,
          profilePicture: value.profilePicture,
          imgId: value.imgId,
          imgVersion: value.imgVersion,
          videoId: value.videoId,
          videoVersion: value.videoVersion,
        } as IPostDocument;

        await Update.prototype.serverUpdatePost(value._id, updatedPost);
      }
    } catch (error) {
      console.error('Error analyzing post content:', error);
      done(error as Error);
    }
  }

  async savePostToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key, value } = job.data;
      await postService.addPostToDB(key, value);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }

  async deletePostFromDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { keyOne, keyTwo } = job.data;
      await postService.deletePost(keyOne, keyTwo);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }

  async updatePostInDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key, value } = job.data;
      await postService.editPost(key, value);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }
}

export const postWorker: PostWorker = new PostWorker();
