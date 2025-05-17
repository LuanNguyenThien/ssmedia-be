import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { Add } from '@root/features-admin/posts/controllers/add-hide-post';
import { Get } from '@root/features-admin/posts/controllers/getPost';
class PostsRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
     this.router.post('/hirepost', authMiddleware.checkAuthentication, Add.prototype.hidePost);
     this.router.post('/unhirepost', authMiddleware.checkAuthentication, Add.prototype.unhidePost);
     this.router.get('/hirepost/:page', authMiddleware.checkAuthentication, Get.prototype.getHiddenPosts);
     this.router.get('/getpostcount', authMiddleware.checkAuthentication, Get.prototype.getPostStats);
     this.router.put('/reportpost/status', authMiddleware.checkAuthentication, Add.prototype.updateReportPostStatus);
   
    return this.router;
  }
}

export const postsRoutes: PostsRoutes = new PostsRoutes();
