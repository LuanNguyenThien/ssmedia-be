import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { Add } from '@report-profiles/controllers/add-report-profile';
import { Get } from '@report-profiles/controllers/get-report-profile';



class ReportProfileRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.post('/reportprofile', authMiddleware.checkAuthentication, Add.prototype.reportProfile);
    this.router.get('/reportprofile/:page', authMiddleware.checkAuthentication, Get.prototype.reportProfiles);
    return this.router;
  }
}

export const reportprofileRoutes: ReportProfileRoutes = new ReportProfileRoutes();
