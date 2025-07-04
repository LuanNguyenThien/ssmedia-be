import { Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IReportPostDocument extends Document {
  _id?: string | ObjectId;
  userId: string;
  postId: string;
  content: string;
  details: string;
  status: 'pending' | 'resolved' | 'rejected';
  createdAt: Date;
}
