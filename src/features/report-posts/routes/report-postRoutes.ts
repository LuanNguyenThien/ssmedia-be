import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { Add } from '@report-posts/controllers/add-report-post';
import {Get } from '@report-posts/controllers/get-report-post'


class ReportPostRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
     this.router.post('/reportpost', authMiddleware.checkAuthentication, Add.prototype.reportPost);
     this.router.get('/reportpost/:page', authMiddleware.checkAuthentication, Get.prototype.reportPosts);
     

    return this.router;
  }
}

export const reportpostRoutes: ReportPostRoutes = new ReportPostRoutes();
