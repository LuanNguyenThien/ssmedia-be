import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { Get } from '@user/controllers/get-profile';
import { Search } from '@user/controllers/search-user';
import { Update } from '@user/controllers/change-password';
import { Edit } from '@user/controllers/update-basic-info';
import { UpdateSettings } from '@user/controllers/update-settings';

class UserRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get('/user/all/:page', authMiddleware.checkAuthentication, Get.prototype.all);
    this.router.get('/user/profile', authMiddleware.checkAuthentication, Get.prototype.profile);
    this.router.get('/user/banuser/:authId', authMiddleware.checkAuthentication, Get.prototype.getBanInfo);
    this.router.get('/user/profile/:userId', authMiddleware.checkAuthentication, Get.prototype.profileByUserId);
    this.router.get('/user/profile/posts/:username/:userId/:uId', authMiddleware.checkAuthentication, Get.prototype.profileAndPosts);
    this.router.get('/user/profile/user/suggestions', authMiddleware.checkAuthentication, Get.prototype.randomUserSuggestions);
    this.router.get('/user/profile/search/:query', authMiddleware.checkAuthentication, Search.prototype.user);
    this.router.get('/user/profile/answers/:userId/:username/:uId', authMiddleware.checkAuthentication, Get.prototype.getUserAnswers);

    this.router.put('/user/profile/change-password', authMiddleware.checkAuthentication, Update.prototype.password);
    this.router.put('/user/profile/basic-info', authMiddleware.checkAuthentication, Edit.prototype.info);
    this.router.put('/user/profile/social-links', authMiddleware.checkAuthentication, Edit.prototype.social);
    this.router.put('/user/profile/personal-hobby', authMiddleware.checkAuthentication, Edit.prototype.personalHobby);
    this.router.put('/user/profile/settings', authMiddleware.checkAuthentication, UpdateSettings.prototype.notification);
    this.router.put('/user/profile/personalize-settings', authMiddleware.checkAuthentication, UpdateSettings.prototype.personalizeSettings);
    this.router.put('/user/profile/personalize-settings/clear', authMiddleware.checkAuthentication, UpdateSettings.prototype.clearAllPersonalized);
    this.router.put('/user/profile/personalize-settings/clear/user-behavior', authMiddleware.checkAuthentication, UpdateSettings.prototype.clearUserBehaviorPersonalized);
    return this.router;
  }
}

export const userRoutes: UserRoutes = new UserRoutes();
