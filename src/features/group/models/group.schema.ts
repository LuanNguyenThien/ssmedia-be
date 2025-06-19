import mongoose, { model, Model, Schema } from 'mongoose';
import { IGroupDocument, IGroupMember } from '@root/features/group/interfaces/group.interface';

const groupMemberSchema = new Schema<IGroupMember>(
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
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      default: 'member'
    },
    joinedBy: {
      type: String
    },
    status: {
      type: String,
      default: 'pending_user'
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    invitedInfo: {
      type: Object,
      default: {
        username: '',
        avatarColor: '',
        profilePicture: '',
        email: ''
      }
    }
  },
  { _id: false }
);

const groupSchema: Schema<IGroupDocument> = new Schema(
  {
    name: {
      type: String,
      unique: true
    },
    description: {
      type: String,
      trim: true
    },
    privacy: {
      type: String,
      default: 'public'
    },
    profileImage: {
      type: String,
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auth'
    },
    members: {
      type: [groupMemberSchema],
      default: []
    },
    tags: {
      type: [String],
      default: []
    },
    group_vector: {
      type: [Number],
      default: undefined
    },
    category: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

groupSchema.pre<IGroupDocument>('save', function (next) {
  if (this.isNew) {
    const creatorId = this.createdBy;
    if (creatorId) {
      const creatorExists = this.members.some((member: IGroupMember) => member.userId && member.userId.toString() === creatorId.toString());

      if (!creatorExists) {
        this.members.unshift({
          userId: creatorId,
          username: '',
          avatarColor: '#ffffff',
          profilePicture: '',
          joinedAt: new Date(),
          role: 'admin',
          joinedBy: 'self',
          status: 'active'
        } as IGroupMember);
      } else {
        const creatorMember = this.members.find(
          (member: IGroupMember) => member.userId && member.userId.toString() === creatorId.toString()
        );
        if (creatorMember) {
          creatorMember.role = 'admin';
          creatorMember.status = 'active';
          creatorMember.joinedBy = 'self';
          creatorMember.joinedAt = new Date();
        }
      }
    }
  }
  next();
});

groupSchema.index({ name: 1 });
groupSchema.index({ createdBy: 1 });
groupSchema.index({ privacy: 1 });
groupSchema.index({ 'members.user': 1 });
groupSchema.index({ 'members.status': 1 });
groupSchema.index({ tags: 1 });
groupSchema.index({ category: 1 });
groupSchema.index({ name: 'text', description: 'text', tags: 'text', category: 'text' });

groupSchema.virtual('activeMemberCount').get(function (this: IGroupDocument) {
  return this.members.filter((member) => member.status === 'active').length;
});

export const GroupModel: Model<IGroupDocument> = model<IGroupDocument>('Group', groupSchema);
