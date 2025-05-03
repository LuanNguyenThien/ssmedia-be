import mongoose, { model, Model, Schema } from 'mongoose';
import { IAppealDocument } from '@appeal/interfaces/appeal.interface';

const AppealSchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  content: { type: String, required: true },
  status: { type: String, enum: ['pending', 'resolved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const AppealModel: Model<IAppealDocument> = model<IAppealDocument>('Appeal', AppealSchema, 'Appeal');

export { AppealModel };
