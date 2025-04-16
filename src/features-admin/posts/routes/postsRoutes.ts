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
     this.router.post('/hirepost/:postId', authMiddleware.checkAuthentication, Add.prototype.hidePost);
     this.router.post('/unhirepost/:postId', authMiddleware.checkAuthentication, Add.prototype.unhidePost);
     this.router.get('/hirepost/', authMiddleware.checkAuthentication, Get.prototype.getHiddenPosts);
   
    return this.router;
  }
}

export const postsRoutes: PostsRoutes = new PostsRoutes();
