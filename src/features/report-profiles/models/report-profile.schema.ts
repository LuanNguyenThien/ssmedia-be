import mongoose, { model, Model, Schema } from 'mongoose';
import { IReportProfileDocument } from '@report-profiles/interfaces/report-profile.interface';

const ReportProfileSchema: Schema = new Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  reason: { type: String, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' }
});

const ReportProfileModel: Model<IReportProfileDocument> = model<IReportProfileDocument>('ReportProfile', ReportProfileSchema, 'ReportProfile');

export { ReportProfileModel };
