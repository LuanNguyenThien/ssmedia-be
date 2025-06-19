import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import { Job, DoneCallback } from 'bull';
import Logger from 'bunyan';
import { config } from '@root/config';
import { postService } from '@service/db/post.service';
import { socketIONotificationObject } from '@socket/notification';
import { postServiceAI } from '@api-serverAI/post/post.AIservice';
import { Update } from '@post/controllers/update-post';
import { IPostDocument } from '@post/interfaces/post.interface';
import { cache } from '@service/redis/cache';
import { INotificationDocument } from '@notification/interfaces/notification.interface';
import { NotificationModel } from '@notification/models/notification.schema';
import { Helpers } from '@global/helpers/helpers';

const postCache = cache.postCache;
const userCache = cache.userCache;
const userBehaviorCache = cache.userBehaviorCache;

const log: Logger = config.createLogger('postWorker');

const W1 = 10.0, W2 = 15.0, W3 = 10.0, W4 = 10.0, W5 = 0.2;

class PostWorker {
  private extractContentFromHtml(html: string): {mediaItems: Array<{type: string, url: string}> } {
    if (!html) {
      return { mediaItems: [] };
    }
  
    // Use cheerio for server-side HTML parsing
    const $ = cheerio.load(html);
    
    // Extract media items
    const mediaItems: Array<{type: string, url: string}> = [];
    
    // Extract images
    $('img').each((_, el) => {
      const url = $(el).attr('src');
      if (url) {
        mediaItems.push({ type: 'image', url });
      }
    });
    
    // Extract videos
    $('video').each((_, el) => {
      const url = $(el).attr('src');
      if (url) {
        mediaItems.push({ type: 'video', url });
      }
    });
    
    // Extract audio
    $('audio').each((_, el) => {
      const url = $(el).attr('src');
      if (url) {
        mediaItems.push({ type: 'audio', url });
      }
    });
    
    return { mediaItems };
  }
  /**
   * Select a subset of media items for analysis
   * @param mediaItems All media items extracted from the HTML
   * @param maxImages Maximum number of images to select (default: 5)
   * @param maxVideos Maximum number of videos to select (default: 1)
   * @param maxAudios Maximum number of audio files to select (default: 1)
   * @returns Selected media items organized by type
   */
  private selectMediaForAnalysis(
    mediaItems: Array<{type: string, url: string}>,
    maxImages: number = 5,
    maxVideos: number = 1, 
    maxAudios: number = 1
  ): { 
    imageUrls: string[], 
    videoUrls: string[], 
    audioUrls: string[] 
  } {
    // Separate media items by type
    const images = mediaItems.filter(item => item.type === 'image');
    const videos = mediaItems.filter(item => item.type === 'video');
    const audios = mediaItems.filter(item => item.type === 'audio');
    
    // Helper function to shuffle an array
    const shuffle = <T>(array: T[]): T[] => {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    };
    
    // Randomly select media items, up to the specified maximums
    const selectedImages = shuffle(images).slice(0, maxImages);
    const selectedVideos = shuffle(videos).slice(0, maxVideos);
    const selectedAudios = shuffle(audios).slice(0, maxAudios);
    
    return {
      imageUrls: selectedImages.map(item => item.url),
      videoUrls: selectedVideos.map(item => item.url),
      audioUrls: selectedAudios.map(item => item.url)
    };
  }
  public async analyzePostContent(job: Job, done: DoneCallback): Promise<void> {
    console.log('Job Data: ', job.data);
    const { value } = job.data;

    try {
      const notificationModel: INotificationDocument = new NotificationModel();
      if(value.type === 'answer' && value.questionCreatedAt) {
        const formattedDateAnswer = Helpers.formattedDate(value.createdAt.toString());
        const formattedDateQuestion = Helpers.formattedDate(value.questionCreatedAt.toString());
        const message = `Your question at ${formattedDateQuestion} has been answered by ${value.username}.`;
        const answerNotification = await notificationModel.insertNotification({
          userFrom: value.userId,
          userTo: value.questionUserId,
          message,
          notificationType: 'post-answer',
          entityId: new mongoose.Types.ObjectId(value.questionId),
          createdItemId: new mongoose.Types.ObjectId(value._id),
          createdAt: new Date(),
          post: value.questionPost,
          htmlPost: value.questionHtmlPost,
          imgId: value.questionImgId!,
          imgVersion: value.questionImgVersion!,
          gifUrl: value.questiongifUrl!,
          comment: '',
          reaction: '',
          post_analysis: '',
          answer: `Your question has been answered by ${value.username} at ${formattedDateAnswer}. Please check the answer.`,
        });
        socketIONotificationObject.emit('insert notification', answerNotification, { userTo: value.questionUserId });
      }
      // Extract media items from HTML content
      const { mediaItems } = postWorker.extractContentFromHtml(value.htmlPost);
      // Select a subset of media items for analysis
      const { imageUrls, videoUrls, audioUrls } = postWorker.selectMediaForAnalysis(mediaItems);
      // Prepare the data for analysis
      value.mediaItems = {
        images: imageUrls,
        videos: videoUrls,
        audios: audioUrls,  
      };
      const response = await postServiceAI.analyzePostContent(value);
      const analysisResult = JSON.parse(response);

      job.progress(100);
      done(null, job.data);

      const educationalValue = analysisResult['Educational Value'];
      const relevanceToLearningCommunity = analysisResult['Relevance to Learning Community'];
      const appropriateness = analysisResult['Content Appropriateness'];
      const reasoning = analysisResult['Reasoning'];

      // Log các giá trị để kiểm tra
      console.log('Educational Value:', educationalValue);
      console.log('Relevance to Learning Community:', relevanceToLearningCommunity);

      if (typeof educationalValue === 'undefined' || typeof relevanceToLearningCommunity === 'undefined') {
        console.error('Missing expected fields in analysis result:', analysisResult);
        return;
      }

      if ((educationalValue < 2 && relevanceToLearningCommunity < 2) || appropriateness === 'Not Appropriate') {
        // Xử lý khi nội dung không phù hợp
        const formattedDate = Helpers.formattedDate(value.createdAt.toString());
        const message = 'Your post at '+ formattedDate + ' has been flagged as inappropriate. Please review the content.';
        console.log(value.userId);
        socketIONotificationObject.emit('post analysis', message, {userId: value.userId} );

        const updatedPost: IPostDocument = {
          htmlPost: value.htmlPost,
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

        const notifications = await notificationModel.insertNotification({
          userFrom: '68032172bdacab3e39fed6e7',
          userTo: value.userId,
          message: message,
          notificationType: 'post-analysis',
          entityId: new mongoose.Types.ObjectId(value._id),
          createdItemId: new mongoose.Types.ObjectId(value._id),
          createdAt: new Date(),
          post: value.post,
          htmlPost: value.htmlPost,
          imgId: value.imgId!,
          imgVersion: value.imgVersion!,
          gifUrl: value.gifUrl!,
          comment: '',
          reaction: '',
          post_analysis: `Your post has been flagged as inappropriate. ${reasoning}  Please review the content.`
        });
        socketIONotificationObject.emit('insert notification', notifications, { userTo: value.userId });
      } else {
        const updatedPost: IPostDocument = {
          htmlPost: value.htmlPost,
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
        const currentUser = await userCache.getUserFromCache(`${value.userId}`);
        if(currentUser?.personalizeSettings?.allowPersonalize !== false && value.type !== 'answer') {
          await postCache.clearPersonalizedPostsCache(value.userId as string);
          // Save user interests from the post analysis
          await userBehaviorCache.saveUserInterests(value.userId as string, value._id, updatedPost);
        }else if(currentUser?.personalizeSettings?.allowPersonalize !== false && value.type === 'answer') {
          await postCache.clearPersonalizedPostsCache(value.userId as string);
          // Save user interests from the post analysis
          await userBehaviorCache.saveUserInterests(value.userId as string, value.questionId, value.question);
        }
        if(value.type !== 'answer') {
          const trendingScore = PostWorker.prototype.calculateTrendingScore(updatedPost, value.reactions, value.commentsCount);
          console.log('Trending Score:', value);
          await postCache.addTrendingPost(value._id, trendingScore);
        }
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
      return commentsCount * W1 + (reactions.upvote - reactions.downvote) * W2;
    }
    return (
      commentsCount * W1 +
      (reactions.upvote - reactions.downvote) * W2 +
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
