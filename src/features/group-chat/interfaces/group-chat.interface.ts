import mongoose, { Document } from 'mongoose';

export interface IGroupChatMember {
  userId: string;
  username: string;
  avatarColor: string;
  profilePicture: string;
  role: 'admin' | 'member';
  state: 'pending' | 'accepted' | 'declined'; // Added 'declined' state
  createdAt: Date;
}

export interface IGroupChatMemberDocument {
  userId: mongoose.Types.ObjectId | string; // Allow both types for flexibility
  username: string;
  avatarColor: string;
  profilePicture: string;
  role: 'admin' | 'member';
  state: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}
  
export interface IGroupChat {
  _id: string; // Not optional, always present
  name: string;
  description?: string;
  profilePicture?: string;
  members: IGroupChatMember[];
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

// Interface for MongoDB document
export interface IGroupChatDocument extends Document {
  _id: mongoose.Types.ObjectId | string;
  name: string;
  description: string;
  profilePicture: string;
  members: IGroupChatMemberDocument[];
  createdBy: mongoose.Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
  
  // We can remove memberCount if it's not actually used
  // Document methods should match actual implementation
  // If these methods aren't implemented, they should be removed
  addMember?(userId: mongoose.Types.ObjectId | string, username: string, avatarColor: string, profilePicture: string): IGroupChatDocument;
  updateMemberState?(userId: mongoose.Types.ObjectId | string, state: 'pending' | 'accepted' | 'declined'): IGroupChatDocument;
  removeMember?(userId: mongoose.Types.ObjectId | string): IGroupChatDocument;
  isAdmin?(userId: mongoose.Types.ObjectId | string): boolean;
}

// More structured job interface with all required properties
export interface IGroupChatJob {
  groupChatId?: string;
  userId?: string;
  state?: 'pending' | 'accepted' | 'declined';
  role?: 'admin' | 'member';
  updateData?: Partial<IGroupChatDocument>;
  avatar?: string;
  imgId?: string;
  imgVersion?: string;
  groupChatMember?: IGroupChatMember;
  groupChatMembers?: IGroupChatMember[];
}

// Additional interface specific to member operations
export interface IGroupChatMemberOperation {
  groupChatId: string;
  userId: string;
  operation: 'add' | 'update' | 'remove';
  data?: Partial<IGroupChatMember>;
}