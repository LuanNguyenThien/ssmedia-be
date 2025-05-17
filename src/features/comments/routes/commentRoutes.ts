import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { Get } from '@comment/controllers/get-comments';
import { Add } from '@comment/controllers/add-comment';
import { CommentReaction } from '@comment/controllers/react-to-comment';
import { Delete } from '@comment/controllers/delete-comment';

class CommentRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get('/post/comments/:postId', authMiddleware.checkAuthentication, Get.prototype.comments);
    this.router.get('/post/commentsnames/:postId', authMiddleware.checkAuthentication, Get.prototype.commentsNames);
    this.router.get('/post/single/comment/:postId/:commentId', authMiddleware.checkAuthentication, Get.prototype.singleComment);
    this.router.get('/post/comment/reaction/:commentId', authMiddleware.checkAuthentication, CommentReaction.prototype.getUserReaction);

    this.router.post('/post/comment', authMiddleware.checkAuthentication, Add.prototype.comment);
    this.router.post('/post/comment/reaction', authMiddleware.checkAuthentication, CommentReaction.prototype.reaction);
    
    this.router.delete('/post/comment/:commentId', authMiddleware.checkAuthentication, Delete.prototype.comment);

    return this.router;
  }
}

export const commentRoutes: CommentRoutes = new CommentRoutes();
