import mongoose, { model, Model, Schema } from 'mongoose';
import { IGroupChatDocument, IGroupChatMemberDocument } from '@root/features/group-chat/interfaces/group-chat.interface';

// Define member schema separately for better reusability and readability
const memberSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    username: {
      type: String,
      required: [true, 'Username is required']
    },
    avatarColor: {
      type: String,
      default: '#ffffff'
    },
    profilePicture: {
      type: String,
      default: ''
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'member'],
        message: '{VALUE} is not a valid role'
      },
      default: 'member'
    },
    state: {
      type: String,
      enum: {
        values: ['pending', 'accepted'],
        message: '{VALUE} is not a valid state'
      },
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const groupChatSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Group chat name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [50, 'Name cannot exceed 50 characters']
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    profilePicture: {
      type: String,
      default: ''
    },
    members: {
      type: [memberSchema],
      validate: {
        validator: function (members: IGroupChatMemberDocument[]) {
          // Ensure at least one admin exists in non-empty groups
          return members.length === 0 || members.some((member) => member.role === 'admin');
        },
        message: 'At least one admin is required in the group'
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator ID is required']
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for faster queries
groupChatSchema.index({ createdBy: 1 });
groupChatSchema.index({ 'members.userId': 1 });
groupChatSchema.index({ name: 'text', description: 'text' }); // Text search index

// Virtual for member count
groupChatSchema.virtual('memberCount').get(function () {
  return this.members.filter((member: IGroupChatMemberDocument) => member.state === 'accepted').length;
});

// Middleware to set the creator as admin and accepted
groupChatSchema.pre('save', function (this: IGroupChatDocument, next) {
  if (this.isNew) {
    const creatorExists = this.members.some((member) => member.userId.toString() === this.createdBy.toString() && member.role === 'admin');

    if (!creatorExists) {
      // Find creator details in members array or use default values
      const existingMember = this.members.find((member) => member.userId.toString() === this.createdBy.toString());

      this.members.push({
        userId: this.createdBy,
        username: existingMember?.username || '', // Will be populated from service layer if not available
        avatarColor: existingMember?.avatarColor || '#ffffff',
        profilePicture: existingMember?.profilePicture || '',
        role: 'admin',
        state: 'accepted',
        createdAt: new Date()
      });
    }
  }
  next();
});

// Remove members if userId field is empty or null
groupChatSchema.pre('save', function (this: IGroupChatDocument, next) {
  this.members = this.members.filter((member) => member.userId);
  next();
});

// Instance methods for common operations
groupChatSchema.methods = {
  addMember(userId: mongoose.Types.ObjectId, username: string, avatarColor: string, profilePicture: string) {
    if (!userId || !username) {
      throw new Error('User ID and username are required');
    }

    if (!this.members.some((member: IGroupChatMemberDocument) => member.userId.toString() === userId.toString())) {
      this.members.push({
        userId,
        username,
        avatarColor: avatarColor || '#ffffff',
        profilePicture: profilePicture || '',
        role: 'member',
        state: 'pending',
        createdAt: new Date()
      });
    }
    return this;
  },

  updateMemberState(userId: mongoose.Types.ObjectId, state: 'pending' | 'accepted') {
    if (!userId || !state) {
      throw new Error('User ID and state are required');
    }

    const memberIndex = this.members.findIndex((member: IGroupChatMemberDocument) => member.userId.toString() === userId.toString());

    if (memberIndex !== -1) {
      this.members[memberIndex].state = state;
    }
    return this;
  },

  removeMember(userId: mongoose.Types.ObjectId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const beforeLength = this.members.length;
    this.members = this.members.filter((member: IGroupChatMemberDocument) => member.userId.toString() !== userId.toString());

    // If the removed member was the last admin and there are still members, promote someone to admin
    const hasAdmin = this.members.some((member: IGroupChatMemberDocument) => member.role === 'admin');
    if (this.members.length > 0 && !hasAdmin) {
      // Promote the first accepted member or the first member if none are accepted
      const acceptedMember = this.members.find((member: IGroupChatMemberDocument) => member.state === 'accepted');
      const memberToPromote = acceptedMember || this.members[0];
      memberToPromote.role = 'admin';
    }

    return this;
  },

  isAdmin(userId: mongoose.Types.ObjectId): boolean {
    if (!userId) {
      return false;
    }
    return this.members.some(
      (member: IGroupChatMemberDocument) =>
        member.userId.toString() === userId.toString() && member.role === 'admin' && member.state === 'accepted'
    );
  },

  setMemberRole(userId: mongoose.Types.ObjectId, role: 'admin' | 'member') {
    if (!userId || !role) {
      throw new Error('User ID and role are required');
    }

    const memberIndex = this.members.findIndex((member: IGroupChatMemberDocument) => member.userId.toString() === userId.toString());

    if (memberIndex !== -1) {
      this.members[memberIndex].role = role;

      // Ensure there's at least one admin remaining
      if (role === 'member' && !this.members.some((m: any, i: any) => i !== memberIndex && m.role === 'admin' && m.state === 'accepted')) {
        throw new Error('Cannot demote the last admin');
      }
    }
    return this;
  }
};

export const GroupChatModel: Model<IGroupChatDocument> = model<IGroupChatDocument>('GroupChat', groupChatSchema, 'GroupChat');
