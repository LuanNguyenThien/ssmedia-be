import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { answerPostSchema } from '@answers/schemes/answer.schemes';
import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import HTTP_STATUS from 'http-status-codes';
import { IPostDocument, IPostJobAnalysis } from '@post/interfaces/post.interface';
import { socketIOPostObject } from '@socket/post';
import { postQueue } from '@service/queues/post.queue';
import { BadRequestError } from '@global/helpers/error-handler';
import { cache } from '@service/redis/cache';
import { postService } from '@service/db/post.service';

const postCache = cache.postCache;

export class CreateAnswer {
  @joiValidation(answerPostSchema)
  public async answer(req: Request, res: Response): Promise<void> {
    const { questionId, bgColor, privacy, gifUrl, profilePicture, feelings } = req.body;
    let { post, htmlPost } = req.body;
    
    // Kiểm tra xem questionId có tồn tại và có phải là question không
    // const question = await postCache.getPostFromCache(questionId);
    const question = await postService.getPostById(questionId);
    console.log('question', question?.type);
    if (!question || (question.type !== 'question' && question.type !== undefined)) {
      throw new BadRequestError('Question does not exist');
    }
    
    const postObjectId: ObjectId = new ObjectId();
    if (post === undefined) {
      post = '';
    }
    
    const createdPost: IPostDocument = {
      _id: postObjectId,
      userId: req.currentUser!.userId,
      username: req.currentUser!.username,
      email: req.currentUser!.email,
      avatarColor: req.currentUser!.avatarColor,
      profilePicture,
      post,
      htmlPost,
      bgColor,
      feelings,
      privacy,
      gifUrl,
      commentsCount: 0,
      imgVersion: '',
      imgId: '',
      videoId: '',
      videoVersion: '',
      createdAt: new Date(),
      reactions: { upvote: 0, downvote: 0 },
      type: 'answer',
      questionId // Thêm questionId để liên kết với question
    } as IPostDocument;

    const analyzePost = {
      _id: postObjectId,
      post,
      htmlPost,
      privacy,
      bgColor,
      feelings,
      gifUrl,
      profilePicture,
      commentsCount: 0,
      reactions: { upvote: 0, downvote: 0 },
      imgId: '',
      imgVersion: '',
      videoId: '',
      videoVersion: '',
      userId: req.currentUser!.userId,
      username: req.currentUser!.username,
      email: req.currentUser!.email,
      avatarColor: req.currentUser!.avatarColor,
      createdAt: new Date(),
      type: 'answer',
      question,
      questionId,
      questionUserId: question?.userId || '',
      questionUsername: question?.username || '',
      questionPost: question?.post || '',
      questionHtmlPost: question?.htmlPost || '',
      questiongifUrl: question?.gifUrl || '',
      questionBgColor: question?.bgColor || '',
      questionImgId: question?.imgId || '',
      questionImgVersion: question?.imgVersion || '',
      questionVideoId: question?.videoId || '',
      questionVideoVersion: question?.videoVersion || '',
      questionCreatedAt: question?.createdAt || new Date(),
    } as IPostJobAnalysis;

    socketIOPostObject.emit('add answer', createdPost); // Emit event riêng cho answer
    await postCache.savePostToCache({
      key: postObjectId,
      currentUserId: `${req.currentUser!.userId}`,
      uId: `${req.currentUser!.uId}`,
      createdPost
    });
    // Thêm job vào queue để lưu vào database
    postQueue.addPostJob('addPostToDB', { key: req.currentUser!.userId, value: createdPost });
    postQueue.addPostJob('analyzePostContent', { value: analyzePost });

    res.status(HTTP_STATUS.CREATED).json({ message: 'Answer created successfully' });
  }
}