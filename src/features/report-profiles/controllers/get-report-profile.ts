import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { reportProfileService } from '@service/db/report-profile.service';
import { IUserDocument } from '@user/interfaces/user.interface';

const PAGE_SIZE = 5;

export class Get {
  public async reportProfiles(req: Request, res: Response): Promise<void> {
    try {
      const { page } = req.params;
      const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
      const limit: number = PAGE_SIZE;
      const newSkip: number = skip === 0 ? skip : skip + 1;
      let reportusers: IUserDocument[] = [];

      
      const { results, total } = await reportProfileService.getReportProfiles(skip, limit);
      

      res.status(HTTP_STATUS.OK).json({ message: 'All report user', results, total });
    } catch (error) {
      console.error('Error getting users:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error getting users' });
    }
  }
}
