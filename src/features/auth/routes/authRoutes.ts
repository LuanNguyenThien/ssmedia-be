import { Password } from '@auth/controllers/password';
import { SignIn } from '@auth/controllers/signin';
import { SignOut } from '@auth/controllers/signout';
import { SignUp } from '@auth/controllers/signup';
import express, { Router } from 'express';

class AuthRoutes {
  private router: Router;
  private signInController: SignIn;
  private signUpController: SignUp;
  private passwordController: Password;
  private signOutController: SignOut;

  constructor() {
    this.router = express.Router();
    this.signInController = new SignIn();
    this.signUpController = new SignUp();
    this.passwordController = new Password();
    this.signOutController = new SignOut();
  }

  public routes(): Router {
    this.router.post('/signup', this.signUpController.create.bind(this.signUpController));
    this.router.post('/signin', this.signInController.read.bind(this.signInController));
    this.router.post('/forgot-password', this.passwordController.create.bind(this.passwordController));
    this.router.post('/checkUser/:authId', this.signInController.checkBanStatus.bind(this.signInController));
    this.router.post('/reset-password/:token', this.passwordController.update.bind(this.passwordController));
    return this.router;
  }

  public signoutRoute(): Router {
    this.router.get('/signout', this.signOutController.update.bind(this.signOutController));
    return this.router;
  }
}

export const authRoutes: AuthRoutes = new AuthRoutes();
