import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { AddAppeal } from '@appeal/controllers/add-appeal';
import { add } from 'lodash';




class AppealRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.post('/appeal', authMiddleware.checkAuthentication, AddAppeal.prototype.appeal);
    
    return this.router;
  }
}

export const appealRoutes: AppealRoutes = new AppealRoutes();
