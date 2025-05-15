import { Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IAppealDocument extends Document {
  _id?: string | ObjectId;
  userId: string;
  content: string;
  status: 'pending' | 'resolved' | 'rejected';
  createdAt: Date;
}
