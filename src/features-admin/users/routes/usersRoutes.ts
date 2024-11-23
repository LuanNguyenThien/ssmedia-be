import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { getUser } from '@users/controllers/getUser';

class UsersRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get('/users/all/:page', authMiddleware.checkAuthentication, getUser.prototype.getAllUsers);
    this.router.get('/users/:userId', authMiddleware.checkAuthentication, getUser.prototype.getByUserId);

    return this.router;
  }
}

export const usersRoutes: UsersRoutes = new UsersRoutes();
