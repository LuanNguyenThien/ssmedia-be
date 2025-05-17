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

  public async getPostChartDataperMonth(req: Request, res: Response): Promise<Response> {
    try {
      const data = await statisticService.countPostsMonth();
      return res.status(HTTP_STATUS.OK).json({ data });
    } catch (error) {
      console.error('Error getting chart data:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error getting chart data' });
    }
  }

  public async getPostChartDataperYear(req: Request, res: Response): Promise<Response> {
    try {
      const data = await statisticService.countPostsPerYear();
      return res.status(HTTP_STATUS.OK).json({ data });
    } catch (error) {
      console.error('Error getting chart data:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error getting chart data' });
    }
  }

  public async getUserChartData(req: Request, res: Response): Promise<Response> {
    try {
      const data = await statisticService.countUsers();
      return res.status(HTTP_STATUS.OK).json({ data });
    } catch (error) {
      console.error('Error getting user chart data:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error getting user chart data' });
    }
  }

  public async getUserChartDataperMonth(req: Request, res: Response): Promise<Response> {
    try {
      const data = await statisticService.countUsersMonth();
      return res.status(HTTP_STATUS.OK).json({ data });
    } catch (error) {
      console.error('Error getting user chart data (month):', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error getting user chart data' });
    }
  }

  public async getUserChartDataperYear(req: Request, res: Response): Promise<Response> {
    try {
      const data = await statisticService.countUsersPerYear();
      return res.status(HTTP_STATUS.OK).json({ data });
    } catch (error) {
      console.error('Error getting user chart data (year):', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error getting user chart data' });
    }
  }
}
