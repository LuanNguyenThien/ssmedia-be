import mongoose, { model, Model, Schema } from 'mongoose';
import { IReportPostDocument } from '@report-posts/interfaces/report-post.interface';

const ReportPostSchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', index: true },
  content: { type: String, required: true },
  details: { type: String },
  status: { type: String, enum: ['pending', 'resolved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const ReportPostModel: Model<IReportPostDocument> = model<IReportPostDocument>('ReportPost', ReportPostSchema, 'ReportPost');

export { ReportPostModel };
