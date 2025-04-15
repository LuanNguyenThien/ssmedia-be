import mongoose, { model, Model, Schema } from 'mongoose';
import { IGroupChatDocument } from '@chat/interfaces/group-chat.interface';

const groupChatSchema: Schema = new Schema({
  name: { type: String, default: '' },
  description: { type: String, default: '' },
  profilePicture: { type: String, default: '' },
  members: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      username: { type: String, default: '' },
      avatarColor: { type: String, default: '' },
      profilePicture: { type: String, default: '' },
      role: { type: String, enum: ['admin', 'member'], default: 'member' },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

export const GroupChatModel: Model<IGroupChatDocument> = model<IGroupChatDocument>('GroupChat', groupChatSchema, 'GroupChat');