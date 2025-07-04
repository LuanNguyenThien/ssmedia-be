import { Request, Response } from 'express';
// import { PostCache } from '@service/redis/post.cache';
import HTTP_STATUS from 'http-status-codes';
import { postQueue } from '@service/queues/post.queue';
import { socketIOPostObject } from '@socket/post';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { postSchema, postWithImageSchema, postWithVideoSchema } from '@post/schemes/post.schemes';
import { IPostDocument, IPostJobAnalysis } from '@post/interfaces/post.interface';
import { UploadApiResponse } from 'cloudinary';
import { uploads, videoUpload } from '@global/helpers/cloudinary-upload';
import { BadRequestError } from '@global/helpers/error-handler';
import { imageQueue } from '@service/queues/image.queue';
import { mediaQueue } from '@service/queues/media.queue';
import { cache } from '@service/redis/cache';
import { ObjectId } from 'mongodb';

// const postCache: PostCache = new PostCache();
const postCache = cache.postCache;

export class Update {
  public async serverUpdatePost(postId: string, updatedPost: IPostDocument): Promise<IPostDocument> {
    const postUpdated: IPostDocument = await postCache.updatePostInCache(postId, updatedPost);
    socketIOPostObject.emit('update post', postUpdated, 'posts');
    const updatePostInDB = await postQueue.addPostJob('updatePostInDB', { key: postId, value: updatedPost });
    if (postUpdated.htmlPost && postUpdated.htmlPost.includes('tmpfiles.org/dl/')) {
          // Thêm job xử lý media
          mediaQueue.addMediaJob('processPostMedia', {
            postId: new ObjectId(postId),
            htmlPost: postUpdated.htmlPost,
            userId: postUpdated.userId,
          }, {
            dependencies: [updatePostInDB.id]
          } as any);
        }
    
    return postUpdated;
  }

  @joiValidation(postSchema)
  public async posts(req: Request, res: Response): Promise<void> {
    let { questionId, type, htmlPost, post, bgColor, feelings, privacy, gifUrl, imgVersion, imgId, profilePicture } = req.body;
    const { postId } = req.params;
    if(htmlPost === undefined) {
      htmlPost = '';
    }
    else if(post === undefined) {
      post = '';
    }
    const updatedPost: IPostDocument = {
      htmlPost,
      post,
      bgColor,
      privacy,
      feelings,
      gifUrl,
      profilePicture,
      imgId,
      imgVersion,
      videoId: '',
      videoVersion: '',
      type: type || (htmlPost ? 'post' : 'question'),
      questionId: questionId ? questionId : undefined,
    } as IPostDocument;

    const postUpdated: IPostDocument = await postCache.updatePostInCache(postId, updatedPost);
    const analyzePost = {
      post: postUpdated.post,
      htmlPost: postUpdated.htmlPost,
      privacy: postUpdated.privacy,
      bgColor: postUpdated.bgColor,
      feelings: postUpdated.feelings,
      gifUrl: postUpdated.gifUrl,
      profilePicture: postUpdated.profilePicture,
      imgId: postUpdated.imgId,
      imgVersion: postUpdated.imgVersion,
      videoId: postUpdated.videoId,
      videoVersion: postUpdated.videoVersion,
      _id: postUpdated._id,
      userId: postUpdated.userId,
      createdAt: postUpdated.createdAt,
      reactions: postUpdated.reactions,
      commentsCount: postUpdated.commentsCount,
      type: postUpdated.type,
    } as IPostJobAnalysis;
    socketIOPostObject.emit('update post', postUpdated, 'posts');
    postQueue.addPostJob('updatePostInDB', { key: postId, value: postUpdated });
    postQueue.addPostJob('analyzePostContent', { value: analyzePost });
    res.status(HTTP_STATUS.OK).json({ message: 'Post updated successfully' });
  }

  @joiValidation(postWithImageSchema)
  public async postWithImage(req: Request, res: Response): Promise<void> {
    const { imgId, imgVersion } = req.body;
    if (imgId && imgVersion) {
      Update.prototype.updatePost(req);
    } else {
      const result: UploadApiResponse = await Update.prototype.addImageToExistingPost(req);
      if (!result.public_id) {
        throw new BadRequestError(result.message);
      }
    }
    res.status(HTTP_STATUS.OK).json({ message: 'Post with image updated successfully' });
  }

  @joiValidation(postWithVideoSchema)
  public async postWithVideo(req: Request, res: Response): Promise<void> {
    const { videoId, videoVersion } = req.body;
    if (videoId && videoVersion) {
      Update.prototype.updatePost(req);
    } else {
      const result: UploadApiResponse = await Update.prototype.addImageToExistingPost(req);
      if (!result.public_id) {
        throw new BadRequestError(result.message);
      }
    }
    res.status(HTTP_STATUS.OK).json({ message: 'Post with video updated successfully' });
  }

  private async updatePost(req: Request): Promise<void> {
    const { post, bgColor, feelings, privacy, gifUrl, imgVersion, imgId, profilePicture, videoId, videoVersion } = req.body;
    const { postId } = req.params;
    const updatedPost: IPostDocument = {
      post,
      bgColor,
      privacy,
      feelings,
      gifUrl,
      profilePicture,
      imgId: imgId ? imgId : '',
      imgVersion: imgVersion ? imgVersion : '',
      videoId: videoId ? videoId : '',
      videoVersion: videoVersion ? videoVersion : '',
      type: 'question'
    } as IPostDocument;

    const postUpdated: IPostDocument = await postCache.updatePostInCache(postId, updatedPost);
    const analyzePost = {
      post: postUpdated.post,
      htmlPost: postUpdated.htmlPost,
      privacy: postUpdated.privacy,
      bgColor: postUpdated.bgColor,
      feelings: postUpdated.feelings,
      gifUrl: postUpdated.gifUrl,
      profilePicture: postUpdated.profilePicture,
      imgId: postUpdated.imgId,
      imgVersion: postUpdated.imgVersion,
      videoId: postUpdated.videoId,
      videoVersion: postUpdated.videoVersion,
      _id: postUpdated._id,
      userId: postUpdated.userId,
      createdAt: postUpdated.createdAt,
      reactions: postUpdated.reactions,
      commentsCount: postUpdated.commentsCount,
      type: postUpdated.type,
    } as IPostJobAnalysis;
    socketIOPostObject.emit('update post', postUpdated, 'posts');
    postQueue.addPostJob('updatePostInDB', { key: postId, value: postUpdated });
    postQueue.addPostJob('analyzePostContent', { value: analyzePost });
  }

  private async addImageToExistingPost(req: Request): Promise<UploadApiResponse> {
    const { post, bgColor, feelings, privacy, gifUrl, profilePicture, image, video } = req.body;
    let { htmlPost } = req.body;
    if(htmlPost === undefined) {
      htmlPost = '';
    }
    const { postId } = req.params;
    const result: UploadApiResponse = image
      ? ((await uploads(image)) as UploadApiResponse)
      : ((await videoUpload(video)) as UploadApiResponse);
    if (!result?.public_id) {
      return result;
    }
    const updatedPost: IPostDocument = {
      post,
      htmlPost,
      bgColor,
      privacy,
      feelings,
      gifUrl,
      profilePicture,
      imgId: image ? result.public_id : '',
      imgVersion: image ? result.version.toString() : '',
      videoId: video ? result.public_id : '',
      videoVersion: video ? result.version.toString() : '',
      type: 'question'
    } as IPostDocument;

    const postUpdated: IPostDocument = await postCache.updatePostInCache(postId, updatedPost);
    const analyzePost = {
      post: postUpdated.post,
      htmlPost: postUpdated.htmlPost,
      privacy: postUpdated.privacy,
      bgColor: postUpdated.bgColor,
      feelings: postUpdated.feelings,
      gifUrl: postUpdated.gifUrl,
      profilePicture: postUpdated.profilePicture,
      imgId: postUpdated.imgId,
      imgVersion: postUpdated.imgVersion,
      videoId: postUpdated.videoId,
      videoVersion: postUpdated.videoVersion,
      _id: postUpdated._id,
      userId: postUpdated.userId,
      createdAt: postUpdated.createdAt,
      reactions: postUpdated.reactions,
      commentsCount: postUpdated.commentsCount,
      type: postUpdated.type,
    } as IPostJobAnalysis;
    socketIOPostObject.emit('update post', postUpdated, 'posts');
    postQueue.addPostJob('updatePostInDB', { key: postId, value: postUpdated });
    postQueue.addPostJob('analyzePostContent', { value: analyzePost });
    if (image) {
      imageQueue.addImageJob('addImageToDB', {
        key: `${req.currentUser!.userId}`,
        imgId: result.public_id,
        imgVersion: result.version.toString()
      });
    }
    return result;
  }
}
