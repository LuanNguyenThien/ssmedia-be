import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { postSchema, postWithImageSchema, postWithVideoSchema } from '@post/schemes/post.schemes';
import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import HTTP_STATUS from 'http-status-codes';
import { IPostDocument, IPostJobAnalysis } from '@post/interfaces/post.interface';
// import { PostCache } from '@service/redis/post.cache';
import { socketIOPostObject } from '@socket/post';
import { postQueue } from '@service/queues/post.queue';
import { UploadApiResponse } from 'cloudinary';
import { uploads, videoUpload } from '@global/helpers/cloudinary-upload';
import { BadRequestError } from '@global/helpers/error-handler';
import { imageQueue } from '@service/queues/image.queue';
import { cache } from '@service/redis/cache';
import { groupService } from '@service/db/group.service';
// const postCache: PostCache = new PostCache();
const postCache = cache.postCache;

export class Create {
  @joiValidation(postSchema)
  public async post(req: Request, res: Response): Promise<void> {
    const { bgColor, privacy, gifUrl, profilePicture, feelings } = req.body;
    let { post, htmlPost, type } = req.body;
    const postObjectId: ObjectId = new ObjectId();
    if (htmlPost === undefined) {
      htmlPost = '';
    } else if (post === undefined) {
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
      type: type || htmlPost ? 'post' : 'question'
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
      createdAt: new Date(),
      type: type || htmlPost ? 'post' : 'question'
    } as IPostJobAnalysis;

    socketIOPostObject.emit('add post', createdPost);
    await postCache.savePostToCache({
      key: postObjectId,
      currentUserId: `${req.currentUser!.userId}`,
      uId: `${req.currentUser!.uId}`,
      createdPost
    });
    postQueue.addPostJob('addPostToDB', { key: req.currentUser!.userId, value: createdPost });
    postQueue.addPostJob('analyzePostContent', { value: analyzePost });
    res.status(HTTP_STATUS.CREATED).json({ message: 'Post created successfully' });
  }

  @joiValidation(postSchema)
  public async grouppost(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const { bgColor, privacy, gifUrl, profilePicture, feelings } = req.body;
    let { post, htmlPost, type } = req.body;
    const postObjectId: ObjectId = new ObjectId();

    if (htmlPost === undefined) htmlPost = '';
    else if (post === undefined) post = '';

    // Lấy group từ DB
    const group = await groupService.getGroupById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    // Kiểm tra quyền admin
    const currentUserId = req.currentUser?.userId;
    if (!currentUserId) {
      throw new BadRequestError('Unauthorized request');
    }

    const currentUserMember = group.members.find((member) => `${member.userId}` === `${currentUserId}`);
    const isAdmin = currentUserMember && currentUserMember.role === 'admin';
    const status = isAdmin ? 'accepted' : 'pending';

    const createdPost: IPostDocument = {
      _id: postObjectId,
      userId: currentUserId,
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
      type: type || htmlPost ? 'post' : 'question',
      groupId: groupId || null,
      status
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
      userId: currentUserId,
      createdAt: new Date(),
      type: type || htmlPost ? 'post' : 'question'
    } as IPostJobAnalysis;

    socketIOPostObject.emit('add post', createdPost);
    await postCache.savePostToCache({
      key: postObjectId,
      currentUserId: `${currentUserId}`,
      uId: `${req.currentUser!.uId}`,
      createdPost
    });
    postQueue.addPostJob('addPostToDB', { key: currentUserId, value: createdPost });
    postQueue.addPostJob('analyzePostContent', { value: analyzePost });
    res.status(HTTP_STATUS.CREATED).json({ message: 'Post created successfully' });
  }

  @joiValidation(postWithImageSchema)
  public async postWithImage(req: Request, res: Response): Promise<void> {
    const { post, bgColor, privacy, gifUrl, profilePicture, feelings, image } = req.body;
    const htmlPost = '';
    const result: UploadApiResponse = (await uploads(image)) as UploadApiResponse;
    if (!result?.public_id) {
      throw new BadRequestError(result.message);
    }

    const postObjectId: ObjectId = new ObjectId();
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
      imgVersion: result.version.toString(),
      imgId: result.public_id,
      videoId: '',
      videoVersion: '',
      createdAt: new Date(),
      reactions: { upvote: 0, downvote: 0 },
      type: 'question'
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
      imgId: result.public_id,
      imgVersion: result.version.toString(),
      videoId: '',
      videoVersion: '',
      userId: req.currentUser!.userId,
      type: 'question'
    } as IPostJobAnalysis;

    socketIOPostObject.emit('add post', createdPost);
    await postCache.savePostToCache({
      key: postObjectId,
      currentUserId: `${req.currentUser!.userId}`,
      uId: `${req.currentUser!.uId}`,
      createdPost
    });
    postQueue.addPostJob('addPostToDB', { key: req.currentUser!.userId, value: createdPost });
    postQueue.addPostJob('analyzePostContent', { value: analyzePost });
    imageQueue.addImageJob('addImageToDB', {
      key: `${req.currentUser!.userId}`,
      imgId: result.public_id,
      imgVersion: result.version.toString()
    });
    res.status(HTTP_STATUS.CREATED).json({ message: 'Post created with image successfully' });
  }

  @joiValidation(postWithVideoSchema)
  public async postWithVideo(req: Request, res: Response): Promise<void> {
    const { post, bgColor, privacy, gifUrl, profilePicture, feelings, video } = req.body;
    const htmlPost = '';
    const result: UploadApiResponse = (await videoUpload(video)) as UploadApiResponse;
    if (!result?.public_id) {
      throw new BadRequestError(result.message);
    }

    const postObjectId: ObjectId = new ObjectId();
    const createdPost: IPostDocument = {
      _id: postObjectId,
      userId: req.currentUser!.userId,
      username: req.currentUser!.username,
      email: req.currentUser!.email,
      avatarColor: req.currentUser!.avatarColor,
      profilePicture,
      post,
      bgColor,
      feelings,
      privacy,
      gifUrl,
      commentsCount: 0,
      imgVersion: '',
      imgId: '',
      videoId: result.public_id,
      videoVersion: result.version.toString(),
      createdAt: new Date(),
      reactions: { upvote: 0, downvote: 0 },
      type: 'question'
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
      videoId: result.public_id,
      videoVersion: result.version.toString(),
      userId: req.currentUser!.userId,
      type: 'question'
    } as IPostJobAnalysis;
    socketIOPostObject.emit('add post', createdPost);
    await postCache.savePostToCache({
      key: postObjectId,
      currentUserId: `${req.currentUser!.userId}`,
      uId: `${req.currentUser!.uId}`,
      createdPost
    });
    postQueue.addPostJob('addPostToDB', { key: req.currentUser!.userId, value: createdPost });
    postQueue.addPostJob('analyzePostContent', { value: analyzePost });
    res.status(HTTP_STATUS.CREATED).json({ message: 'Post created with video successfully' });
  }
}
