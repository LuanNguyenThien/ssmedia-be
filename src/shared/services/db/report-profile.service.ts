import { ObjectId } from 'mongodb';
import { IUserDocument } from '@user/interfaces/user.interface';
import { ReportProfileModel } from '@report-profiles/models/report-profile.schema';
import { IReportProfileDocument } from '@report-profiles/interfaces/report-profile.interface'; 
import { PostModel } from '@post/models/post.schema';
import { userService } from './user.service';

class ReportProfileService {
  public async addReportProfile(reportProfileData: IReportProfileDocument): Promise<IReportProfileDocument> {
    // const { userId, postId, content } = reportProfileData;

    return await ReportProfileModel.create(reportProfileData);
  }

  public async getReportProfiles(skip: number, limit: number): Promise<IUserDocument[]> {
    const reportProfiles: IReportProfileDocument[] = await ReportProfileModel.find().exec();

    const reportedUserIds: string[] = reportProfiles.map((report) => report.reportedUserId);

    const users: IUserDocument[] = await userService.getUsers({ _id: { $in: reportedUserIds } }, skip, limit, { createAt: -1 });

    return users;
  }
}

export const reportProfileService: ReportProfileService = new ReportProfileService();
