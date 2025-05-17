import { IReactions } from '@root/features/reactions/interfaces/reaction.interface';
import { ObjectId } from 'mongodb';
import mongoose, { Document } from 'mongoose';

export interface IPostDocument extends Document {
  _id?: string | mongoose.Types.ObjectId;
  userId: string;
  username: string;
  email: string;
  avatarColor: string;
  profilePicture: string;
  post: string;
  htmlPost?: string;
  bgColor: string;
  commentsCount: number;
  imgVersion?: string;
  imgId?: string;
  videoId?: string;
  videoVersion?: string;
  feelings?: string;
  gifUrl?: string;
  privacy?: string;
  reactions?: IReactions;
  analysis?: {
    mainTopics?: string[];
    educationalValue?: number;
    relevance?: number;
    appropriateness?: {
      evaluation?: string;
    };
    keyConcepts?: string[];
    learningOutcomes?: string[];
    disciplines?: string[];
    classification?: {
      type?: string;
      subject?: string;
      agesuitable?: string;
    };
    engagementPotential?: number;
    credibilityScore?: number;
    improvementSuggestions?: string[];
    relatedTopics?: string[];
    contentTags?: string[];
  };
  vector?: any[]; // Store the vectorized data here
  createdAt?: Date;
  score?: number;
  favoritedBy?: string[];
  isHidden?: Boolean;
  hiddenReason?: string;
  hiddenAt?: Date;
}

export interface IPostJobAnalysis {
  _id?: string | mongoose.Types.ObjectId;
  post?: string;
  htmlPost?: string;
  bgColor?: string;
  feelings?: string;
  privacy?: string;
  gifUrl?: string;
  profilePicture?: string;
  imgId?: string;
  imgVersion?: string;
  videoId?: string;
  videoVersion?: string;
  createdAt?: Date;
}

export interface IGetPostsQuery {
  _id?: ObjectId | string | { $in: string[] };
  username?: string;
  imgId?: string;
  gifUrl?: string;
  videoId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ISavePostToCache {
  key: ObjectId | string;
  currentUserId: string;
  uId: string;
  createdPost: IPostDocument;
}

export interface IPostJobData {
  key?: string;
  value?: IPostDocument | IPostJobAnalysis;
  keyOne?: string;
  keyTwo?: string;
}

export interface IQueryComplete {
  ok?: number;
  n?: number;
}

export interface IQueryDeleted {
  deletedCount?: number;
}
