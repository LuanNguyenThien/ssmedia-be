import mongoose, { Document } from 'mongoose';

export interface IGroupChatMember {
  userId: string;
  username: string;
  avatarColor: string;
  profilePicture: string;
  role: 'admin' | 'member';
  state: 'pending' | 'accepted';
  createdAt: Date;
}

export interface IGroupChatMemberDocument {
  userId: mongoose.Types.ObjectId;
  username: string;
  avatarColor: string;
  profilePicture: string;
  role: 'admin' | 'member';
  state: 'pending' | 'accepted';
  createdAt: Date;
}
  
export interface IGroupChat {
  _id?: string;
  name: string;
  description?: string;
  profilePicture?: string;
  members: IGroupChatMember[];
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface IGroupChatDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  profilePicture: string;
  members: IGroupChatMemberDocument[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;
  
  // Document methods
  addMember(userId: mongoose.Types.ObjectId, username: string, avatarColor: string, profilePicture: string): IGroupChatDocument;
  updateMemberState(userId: mongoose.Types.ObjectId, state: 'pending' | 'accepted'): IGroupChatDocument;
  removeMember(userId: mongoose.Types.ObjectId): IGroupChatDocument;
  isAdmin(userId: mongoose.Types.ObjectId): boolean;
}

export interface IGroupChatJob {
  groupChatId?: string;
  groupChatMember?: IGroupChatMember;
  groupChatMembers?: IGroupChatMember[];
}