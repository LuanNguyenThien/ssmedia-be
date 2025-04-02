import mongoose, { Document } from 'mongoose';

export interface IGroupChatMember {
    userId: string;
    username: string;
    avatarColor: string;
    profilePicture: string;
    role: 'admin' | 'member';
    createdAt: Date;
  }

  export interface IGroupChatMemberDocument {
    userId: mongoose.Types.ObjectId;
    username: string;
    avatarColor: string;
    profilePicture: string;
    role: 'admin' | 'member';
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
  }

export interface IGroupChatDocument extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    description: string;
    profilePicture: string;
    members: IGroupChatMemberDocument[];
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
}

export interface IGroupChatJob {
    groupChatId?: string;
    groupChatMember?: IGroupChatMember;
    groupChatMembers?: IGroupChatMember[];
}