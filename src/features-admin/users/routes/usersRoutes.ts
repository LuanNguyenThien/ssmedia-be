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
    this.router.get('/newusertoday', authMiddleware.checkAuthentication, getUser.prototype.getNewUsersToday);
    this.router.post('/banuser/', authMiddleware.checkAuthentication, Add.prototype.banUser);
    this.router.post('/unbanuser/', authMiddleware.checkAuthentication, Add.prototype.unbanUser);
    this.router.get('/banuser/:page', authMiddleware.checkAuthentication, getUser.prototype.getBannedUsers);
    this.router.put('/reportprofile/status', authMiddleware.checkAuthentication, Add.prototype.updateReportStatus);
    return this.router;
  }
}

export const usersRoutes: UsersRoutes = new UsersRoutes();
