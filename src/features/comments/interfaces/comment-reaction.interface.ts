import { ObjectId } from 'mongodb';
import { Document } from 'mongoose';

export interface ICommentReactionDocument extends Document {
  _id?: string | ObjectId;
  username: string;
  avatarColor: string;
  type: string; // 'upvote' or 'downvote'
  commentId: string;
  postId: string;
  profilePicture: string;
  createdAt?: Date;
  userTo?: string | ObjectId;
}

export interface ICommentReactionJob {
  commentId: string;
  postId: string;
  username: string;
  previousReaction: string;
  userTo?: string;
  userFrom?: string;
  type?: string;
  reactionObject?: ICommentReactionDocument;
}

export interface IQueryCommentReaction {
  _id?: string | ObjectId;
  commentId?: string | ObjectId;
  postId?: string | ObjectId;
  username?: string;
}

export interface IReactionResponse {
  message: string;
  commentReaction?: ICommentReactionDocument;
} 