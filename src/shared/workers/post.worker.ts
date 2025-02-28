import { Job, DoneCallback } from 'bull';
import Logger from 'bunyan';
import { config } from '@root/config';
import { postService } from '@service/db/post.service';
import { socketIONotificationObject } from '@socket/notification';
import { postServiceAI } from '@api-serverAI/post/post.AIservice';
import { Update } from '@post/controllers/update-post';
import { IPostDocument } from '@post/interfaces/post.interface';
import { cache } from '@service/redis/cache';

const postCache = cache.postCache;

const log: Logger = config.createLogger('postWorker');

const W1 = 1.0, W2 = 0.5, W3 = 10.0, W4 = 10.0, W5 = 0.1;

class PostWorker {
  public async analyzePostContent(job: Job, done: DoneCallback): Promise<void> {
    console.log('Job Data: ', job.data);
    const { value } = job.data;

    try {
      const response = await postServiceAI.analyzePostContent(value);
      const analysisResult = JSON.parse(response);

      job.progress(100);
      done(null, job.data);

      const educationalValue = analysisResult['Educational Value'];
      const relevanceToLearningCommunity = analysisResult['Relevance to Learning Community'];
      const appropriateness = analysisResult['Content Appropriateness'];

      // Log các giá trị để kiểm tra
      console.log('Educational Value:', educationalValue);
      console.log('Relevance to Learning Community:', relevanceToLearningCommunity);

      if (typeof educationalValue === 'undefined' || typeof relevanceToLearningCommunity === 'undefined') {
        console.error('Missing expected fields in analysis result:', analysisResult);
        return;
      }

      if ((educationalValue < 2 && relevanceToLearningCommunity < 2) || appropriateness === 'Not Appropriate') {
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
      } else {
        const updatedPost: IPostDocument = {
          post: value.post,
          bgColor: value.bgColor,
          privacy: value.privacy,
          feelings: value.feelings,
          gifUrl: value.gifUrl,
          profilePicture: value.profilePicture,
          imgId: value.imgId,
          imgVersion: value.imgVersion,
          videoId: value.videoId,
          videoVersion: value.videoVersion,
          analysis: {
            mainTopics: analysisResult['Main Topics'],
            educationalValue: analysisResult['Educational Value'],
            relevance: analysisResult['Relevance to Learning Community'],
            appropriateness: {
              evaluation: analysisResult['Content Appropriateness']['Evaluation'],
            },
            keyConcepts: analysisResult['Key Concepts'],
            learningOutcomes: analysisResult['Potential Learning Outcomes'],
            disciplines: analysisResult['Related Academic Disciplines'],
            classification: {
              type: analysisResult['Content Classification']['Type'],
              subject: analysisResult['Content Classification']['Subject'],
              agesuitable: analysisResult['Content Classification']['Range Age Suitable']
            },
            engagementPotential: analysisResult['Engagement Potential'],
            credibilityScore: analysisResult['Credibility and Sources'],
            improvementSuggestions: analysisResult['Improvement Suggestions'],
            relatedTopics: analysisResult['Related Topics'],
            contentTags: analysisResult['Content Tags']
          }
        } as IPostDocument;
        await Update.prototype.serverUpdatePost(value._id, updatedPost);
        
        const trendingScore = PostWorker.prototype.calculateTrendingScore(updatedPost, value.reactions, value.commentsCount);
        await postCache.addTrendingPost(value._id, trendingScore);
      }

    } catch (error) {
      console.error('Error analyzing post content:', error);
      done(error as Error);
    }
  }

  private calculateTrendingScore(post: IPostDocument, reactions: any, commentsCount: number): number {
    if (!reactions || reactions.length === 0) 
      return commentsCount * W1;
    if (!post.analysis) {
      return post.commentsCount * W1 + (reactions.like + reactions.love + reactions.happy +
        reactions.wow - reactions.sad - reactions.angry) * W2;
    }
    return (
      commentsCount * W1 +
      (reactions.like + reactions.love + reactions.happy +
        reactions.wow - reactions.sad - reactions.angry) * W2 +
      (post.analysis.educationalValue ?? 0) * W3 +
      (post.analysis.relevance ?? 0) * W4 +
      (post.analysis.engagementPotential ?? 0) * W5
    );
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
