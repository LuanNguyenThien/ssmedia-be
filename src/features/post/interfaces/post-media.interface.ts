import { ObjectId } from 'mongodb';

export interface IMediaProcessingJob {
  postId: ObjectId;
  htmlPost: string;
  userId: string;
}

export interface IPostMediaItem {
  originalUrl: string;
  cloudinaryUrl: string;
  mediaType: 'image' | 'audio' | 'video';
  publicId: string;
  version: string;
}

export interface IProcessedMedia {
  postId: ObjectId;
  htmlContent: string;
  mediaItems: IPostMediaItem[];
}