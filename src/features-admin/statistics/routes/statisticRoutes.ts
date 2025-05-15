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
    this.router.get('/statistic/postpermonth', authMiddleware.checkAuthentication, Get.prototype.getPostChartDataperMonth);
    this.router.get('/statistic/postperyear', authMiddleware.checkAuthentication, Get.prototype.getPostChartDataperYear);
    this.router.get('/statistic/user', authMiddleware.checkAuthentication, Get.prototype.getUserChartData);
    this.router.get('/statistic/userpermonth', authMiddleware.checkAuthentication, Get.prototype.getUserChartDataperMonth);
    this.router.get('/statistic/userperyear', authMiddleware.checkAuthentication, Get.prototype.getUserChartDataperYear);

    return this.router;
  }
}

export const statisticRoutes: StatisticRoutes = new StatisticRoutes();
