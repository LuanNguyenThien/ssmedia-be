  import mongoose, { Document } from 'mongoose';

  export interface IGroupMember {
    userId: mongoose.Types.ObjectId | string; // Allow both ObjectId and string for flexibility
    username?: string;
    avatarColor?: string;
    profilePicture?: string;
    joinedAt: Date;
    role: 'member' | 'admin';
    joinedBy: 'self' | 'invited';
    status: 'pending_user' | 'pending_admin' | 'active' | 'rejected' | 'deleted';
    invitedBy?: mongoose.Types.ObjectId;
  }
  export interface IGroupCreate {
    name: string;
    description?: string;
    privacy: 'public' | 'private';
    profileImage?: string;
    createdBy: mongoose.Types.ObjectId;
    members: IGroupMember[];
    tags?: string[];
    category?: string[];
    // Không bao gồm createdAt, updatedAt vì chúng được tạo tự động
  }
    
    
    export interface IGroupDocument extends Document {
      name: string;
      description?: string;
      privacy: 'public' | 'private';
      profileImage?: string;
      createdBy: mongoose.Types.ObjectId ;
      members: IGroupMember[];
      tags?: string[];
      group_vector?: number[];
      category?: string[];
      createdAt: Date;
      updatedAt: Date;
    }
    