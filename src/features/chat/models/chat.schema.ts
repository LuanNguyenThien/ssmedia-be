import mongoose, { Model, model, Schema } from 'mongoose';
import { IMessageDocument } from '@chat/interfaces/chat.interface';

const messageSchema: Schema = new Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderUsername: { type: String, default: '' },
  senderAvatarColor: { type: String, default: '' },
  senderProfilePicture: { type: String, default: '' },
  receiverUsername: { type: String, default: '' },
  receiverAvatarColor: { type: String, default: '' },
  receiverProfilePicture: { type: String, default: '' },
  isGroupChat: { type: Boolean, default: false },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupChat', default: null },
  groupName: { type: String, default: '' },
  body: { type: String, default: '' },
  gifUrl: { type: String, default: '' },
  isRead: { type: Boolean, default: false },
  deleteForMe: { type: Boolean, default: false },
  deleteForEveryone: { type: Boolean, default: false },
  selectedImage: { type: String, default: '' },
  reaction: Array,
  messageType: { type: String, default: '' },
  callId: { type: String, default: '' },
  callType: { type: String, default: '' },
  callDuration: { type: Number, default: 0 },
  callStatus: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, createdAt: -1 });
messageSchema.index({ groupId: 1, isGroupChat: 1, createdAt: -1 });

const MessageModel: Model<IMessageDocument> = model<IMessageDocument>('Message', messageSchema, 'Message');
export { MessageModel };
