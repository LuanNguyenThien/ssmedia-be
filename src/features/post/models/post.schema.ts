import mongoose, { model, Model, Schema } from 'mongoose';
import { IPostDocument } from '@post/interfaces/post.interface';

const postSchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  username: { type: String },
  email: { type: String },
  avatarColor: { type: String },
  profilePicture: { type: String },
  post: { type: String, default: '' },
  htmlPost: { type: String, default: '' },
  bgColor: { type: String, default: '' },
  imgVersion: { type: String, default: '' },
  imgId: { type: String, default: '' },
  videoVersion: { type: String, default: '' },
  videoId: { type: String, default: '' },
  feelings: { type: String, default: '' },
  gifUrl: { type: String, default: '' },
  privacy: { type: String, default: '' },
  commentsCount: { type: Number, default: 0 },
  reactions: {
    upvote: { type: Number, default: 0 },
    downvote: { type: Number, default: 0 }
  },
  favoritedBy: { type: [String], default: [] },
  analysis: {
    mainTopics: [String],
    educationalValue: { type: Number },
    relevance: { type: Number },
    appropriateness: {
      evaluation: { type: String }
    },
    keyConcepts: [String],
    learningOutcomes: [String],
    disciplines: [String],
    classification: {
      type: { type: String },
      subject: { type: String },
      agesuitable: { type: String }
    },
    engagementPotential: { type: Number },
    credibilityScore: { type: Number },
    improvementSuggestions: [String],
    relatedTopics: [String],
    contentTags: [String]
  },
  vector: { type: Array, default: [] }, // Store the vectorized data here
  createdAt: { type: Date, default: Date.now },
  isHidden: {
    type: Boolean,
    default: false
  }
});

const PostModel: Model<IPostDocument> = model<IPostDocument>('Post', postSchema, 'Post');

export { PostModel };
