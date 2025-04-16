import { Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IReportProfileDocument extends Document {
  _id?: string | ObjectId;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  description: string;
  status: string;
  createdAt: Date;
}
