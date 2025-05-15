import { ObjectId } from 'mongodb';
import { IGetPostsQuery, IPostDocument } from '@post/interfaces/post.interface';
import { ReportPostModel } from '@report-posts/models/report-post.schema';
import { IAppealDocument } from '@appeal/interfaces/appeal.interface';
import { AppealModel } from '@appeal/models/appeal.schema';
import { postService } from './post.service';

class AppealService {
  public async addAppeal(AppealData: IAppealDocument): Promise<IAppealDocument> {
    const { userId, content } = AppealData;

    return await AppealModel.create(AppealData);
  }

  public async updateAppealStatus(
    appealId: string,
    status: 'pending' | 'reviewed' | 'resolved'
  ): Promise<IAppealDocument | null> {
    const updated = await AppealModel.findByIdAndUpdate(appealId, { status }, { new: true });

    return updated;
  }
  
}

export const appealService: AppealService = new AppealService();
