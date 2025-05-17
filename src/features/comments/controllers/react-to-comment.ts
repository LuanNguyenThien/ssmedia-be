import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { ObjectId } from 'mongodb';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { BadRequestError } from '@global/helpers/error-handler';
import { reactionCommentSchema } from '@comment/schemes/comment';
import { ICommentDocument } from '@comment/interfaces/comment.interface';
import { CommentsModel } from '@comment/models/comment.schema';
import { CommentReactionModel } from '@comment/models/comment-reaction.schema';
import { ICommentReactionDocument } from '@comment/interfaces/comment-reaction.interface';
import mongoose from 'mongoose';

export class CommentReaction {
  @joiValidation(reactionCommentSchema)
  public async reaction(req: Request, res: Response): Promise<void> {
    const { commentId, reaction, postId } = req.body;
    
    if (!mongoose.isValidObjectId(commentId)) {
      throw new BadRequestError('Invalid commentId');
    }
    
    const comment: ICommentDocument | null = await CommentsModel.findById(commentId);
    if (!comment) {
      throw new BadRequestError('Comment not found');
    }
    
    // Check if user has already reacted to this comment
    const existingReaction = await CommentReactionModel.findOne({
      commentId,
      username: req.currentUser!.username
    });
    
    // Get current reaction counts
    const updatedComment = await CommentReaction.updateCommentReaction(
      commentId, 
      reaction, 
      req.currentUser!.username,
      existingReaction?.type
    );
    
    // Track the user's reaction
    if (reaction.includes('-remove')) {
      // If removing a reaction, delete the record
      if (existingReaction) {
        await CommentReactionModel.deleteOne({ _id: existingReaction._id });
      }
    } else {
      // For adding or changing reaction
      if (existingReaction) {
        // Update existing reaction type
        await CommentReactionModel.updateOne(
          { _id: existingReaction._id },
          { $set: { type: reaction } }
        );
      } else {
        // Create new reaction
        const reactionObject: ICommentReactionDocument = {
          _id: new ObjectId(),
          commentId,
          postId,
          type: reaction,
          avatarColor: req.currentUser!.avatarColor,
          username: req.currentUser!.username,
          profilePicture: req.body.profilePicture || ''
        } as ICommentReactionDocument;
        
        await CommentReactionModel.create(reactionObject);
      }
    }
    
    res.status(HTTP_STATUS.OK).json({ 
      message: 'Reaction updated successfully', 
      comment: updatedComment 
    });
  }
  
  private static async updateCommentReaction(
    commentId: string, 
    reaction: string, 
    username: string,
    existingReactionType?: string
  ): Promise<ICommentDocument> {
    const comment = await CommentsModel.findById(commentId);
    let upvoteValue = comment?.reactions.upvote || 0;
    let downvoteValue = comment?.reactions.downvote || 0;
    
    // Handle removing existing reaction first
    if (existingReactionType === 'upvote') {
      upvoteValue = Math.max(0, upvoteValue - 1);
    } else if (existingReactionType === 'downvote') {
      downvoteValue = Math.max(0, downvoteValue - 1);
    }
    
    // Handle adding new reaction
    if (reaction === 'upvote') {
      upvoteValue += 1;
    } else if (reaction === 'downvote') {
      downvoteValue += 1;
    }
    // For '-remove' reactions, we've already decremented above
    
    const updatedComment = await CommentsModel.findOneAndUpdate(
      { _id: commentId },
      {
        $set: {
          'reactions.upvote': upvoteValue,
          'reactions.downvote': downvoteValue
        }
      },
      { new: true }
    );
    
    return updatedComment as ICommentDocument;
  }
  
  public async getUserReaction(req: Request, res: Response): Promise<void> {
    const { commentId } = req.params;
    const { username } = req.currentUser!;
    
    if (!mongoose.isValidObjectId(commentId)) {
      throw new BadRequestError('Invalid commentId');
    }
    
    const userReaction = await CommentReactionModel.findOne({ commentId, username });
    
    res.status(HTTP_STATUS.OK).json({
      message: 'User reaction retrieved successfully',
      reaction: userReaction ? userReaction.type : null
    });
  }
} 