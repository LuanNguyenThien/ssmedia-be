import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { statisticService } from '@service/db/statistic.service'; 

export class Get {
  public async getPostChartData(req: Request, res: Response): Promise<Response> {
    try {
      const data = await statisticService.countPostsPerDay();
      return res.status(HTTP_STATUS.OK).json({ data });
    } catch (error) {
      console.error('Error getting chart data:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error getting chart data' });
    }
  }
}
