import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import HTTP_STATUS from 'http-status-codes';
import { ReportProfilesSchema } from '@report-profiles/schemes/report-profile';
import { IPostDocument } from '@post/interfaces/post.interface';

import { reportPostQueue } from '@service/queues/reportpost.queue';
import { IReportProfileDocument } from '@report-profiles/interfaces/report-profile.interface';
import { reportProfileService } from '@service/db/report-profile.service';
import { BadRequestError } from '@global/helpers/error-handler';

export class Add {
  @joiValidation(ReportProfilesSchema)
  public async reportProfile(req: Request, res: Response): Promise<void> {
    const { reportedUserId, reason, description } = req.body;
    const reporterId = req.currentUser!.userId;
    const reportProfileObjectId: ObjectId = new ObjectId();

    const reportProfile: IReportProfileDocument = {
      _id: reportProfileObjectId,
      reporterId,
      reportedUserId,
      reason,
      description,
      status: 'pending',
      createdAt: new Date()
    } as IReportProfileDocument;

    const report = await reportProfileService.addReportProfile(reportProfile);
    // reportPostQueue.addReportPostJob('addreportPostToDB', reportPost);

    res.status(HTTP_STATUS.CREATED).json({ message: 'Report profile successfully' });
  }

  
}
