import { ICommentReactionDocument } from '@comment/interfaces/comment-reaction.interface';
import mongoose, { model, Model, Schema } from 'mongoose';

const commentReactionSchema: Schema = new Schema({
  commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', index: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', index: true },
  type: { type: String, default: '', index: true }, // 'upvote' or 'downvote'
  username: { type: String, default: '', index: true },
  avatarColor: { type: String, default: '' },
  profilePicture: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now() }
});

// Compound index to ensure a user can only have one reaction per comment
commentReactionSchema.index({ commentId: 1, username: 1 }, { unique: true });

const CommentReactionModel: Model<ICommentReactionDocument> = model<ICommentReactionDocument>(
  'CommentReaction', 
  commentReactionSchema, 
  'CommentReaction'
);

export { CommentReactionModel }; 