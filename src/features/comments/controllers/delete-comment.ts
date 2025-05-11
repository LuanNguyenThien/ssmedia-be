import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { ObjectId } from 'mongodb';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { BadRequestError } from '@global/helpers/error-handler';
import { ICommentDocument } from '@comment/interfaces/comment.interface';
import { CommentsModel } from '@comment/models/comment.schema';
import { PostModel } from '@post/models/post.schema';
import mongoose from 'mongoose';

export class Delete {
  public async comment(req: Request, res: Response): Promise<void> {
    const { commentId } = req.params;
    
    if (!mongoose.isValidObjectId(commentId)) {
      throw new BadRequestError('Invalid commentId');
    }
    
    const comment: ICommentDocument | null = await CommentsModel.findById(commentId);
    if (!comment) {
      throw new BadRequestError('Comment not found');
    }
    
    // Check if user is authorized to delete this comment
    if (comment.username !== req.currentUser!.username) {
      throw new BadRequestError('You are not authorized to delete this comment');
    }
    
    const postId = comment.postId;
    
    // Delete the comment
    await CommentsModel.deleteOne({ _id: commentId });
    
    // Decrement the commentsCount in the post
    await PostModel.updateOne(
      { _id: postId },
      { $inc: { commentsCount: -1 } }
    );
    
    res.status(HTTP_STATUS.OK).json({ message: 'Comment deleted successfully' });
  }
} 