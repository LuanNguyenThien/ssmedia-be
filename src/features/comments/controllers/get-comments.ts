import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { ICommentDocument, ICommentNameList } from '@comment/interfaces/comment.interface';
import { commentService } from '@service/db/comment.service';
import mongoose from 'mongoose';

export class Get {
  public async comments(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const comments: ICommentDocument[] = await commentService.getPostComments(
      { postId: new mongoose.Types.ObjectId(postId) }, 
      { createdAt: -1 }
    );

    res.status(HTTP_STATUS.OK).json({ message: 'Post comments', comments });
  }

  public async commentsNames(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const commentsNames: ICommentNameList[] = await commentService.getPostCommentNames(
      { postId: new mongoose.Types.ObjectId(postId) }, 
      { createdAt: -1 }
    );

    res.status(HTTP_STATUS.OK).json({ 
      message: 'Post comments names', 
      comments: commentsNames.length ? commentsNames[0] : [] 
    });
  }

  public async singleComment(req: Request, res: Response): Promise<void> {
    const { postId, commentId } = req.params;
    const comments: ICommentDocument[] = await commentService.getPostComments(
      { _id: new mongoose.Types.ObjectId(commentId) }, 
      { createdAt: -1 }
    );

    res.status(HTTP_STATUS.OK).json({ 
      message: 'Single comment', 
      comments: comments.length ? comments[0] : [] 
    });
  }
}
