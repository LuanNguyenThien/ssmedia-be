import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { getUser } from '@users/controllers/getUser';
import { Add } from '@users/controllers/add-ban-profie';

class UsersRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get('/users/all/:page', authMiddleware.checkAuthentication, getUser.prototype.getAllUsers);
    this.router.get('/users/:userId', authMiddleware.checkAuthentication, getUser.prototype.getByUserId);
    this.router.post('/banuser/', authMiddleware.checkAuthentication, Add.prototype.banUser);
    this.router.get('/banuser/', authMiddleware.checkAuthentication, getUser.prototype.getBannedUsers);

    return this.router;
  }
}

export const usersRoutes: UsersRoutes = new UsersRoutes();
