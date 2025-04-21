import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { userBanService } from '@service/db/ban-user.service';
import { reportProfileService } from '@service/db/report-profile.service';
import { BadRequestError } from '@global/helpers/error-handler'; 
export class Add {
  public async banUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId, reason } = req.body;
      const updatedUser = await userBanService.banUserByUserId(userId, reason);

      if (!updatedUser) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'User not found' });
        return;
      }

      res.status(HTTP_STATUS.OK).json({ message: 'User banned successfully', data: updatedUser });
    } catch (error) {
      console.error('Error banning user:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Failed to ban user' });
    }
  }

  public async unbanUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.body;
      const updatedUser = await userBanService.unbanUserByUserId(userId);

      if (!updatedUser) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'User not found' });
        return;
      }

      res.status(HTTP_STATUS.OK).json({ message: 'User unbanned successfully', data: updatedUser });
    } catch (error) {
      console.error('Error unbanning user:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Failed to unban user' });
    }
  }

  public async updateReportStatus(req: Request, res: Response): Promise<void> {
    const { reportId, status } = req.body;

    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      throw new BadRequestError('Invalid status value');
    }

    const updatedReport = await reportProfileService.updateReportProfileStatus(reportId, status);

    if (!updatedReport) {
      throw new BadRequestError('Report not found');
    }

    res.status(HTTP_STATUS.OK).json({ message: 'Report status updated successfully', updatedReport });
  }
}
