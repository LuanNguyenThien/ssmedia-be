import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { Get } from '@root/features-admin/statistics/controllers/getStatistic';

class StatisticRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
     this.router.get('/statistic/post', authMiddleware.checkAuthentication, Get.prototype.getPostChartData);
     
   
    return this.router;
  }
}

export const statisticRoutes: StatisticRoutes = new StatisticRoutes();
