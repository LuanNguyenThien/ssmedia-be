
import { ReportProfilesSchema } from '@report-profiles/schemes/report-profile';
import { IPostDocument } from '@post/interfaces/post.interface';

import { reportPostQueue } from '@service/queues/reportpost.queue';
import { IReportProfileDocument } from '@report-profiles/interfaces/report-profile.interface';
import { reportProfileService } from '@service/db/report-profile.service';
import { BadRequestError } from '@global/helpers/error-handler';

import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { ObjectId } from 'mongodb';

import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { AppealSchema } from '@appeal/schemes/appeal';
import { IAppealDocument } from '@appeal/interfaces/appeal.interface';
import { appealService } from '@service/db/appeal.service';



export class AddAppeal {
  @joiValidation(AppealSchema)
  public async appeal(req: Request, res: Response): Promise<void> {
    const {  content } = req.body;
    const userId = req.currentUser?.userId;

    if (!userId || !content) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Thiếu dữ liệu yêu cầu' });
      return;
    }

    const appeal: IAppealDocument = {
      _id: new ObjectId(),
      userId,
      content,
      status: 'pending',
      createdAt: new Date()
    } as IAppealDocument;

    await appealService.addAppeal(appeal);

    res.status(HTTP_STATUS.CREATED).json({ message: 'Gửi đơn kháng nghị thành công' });
  }
}
