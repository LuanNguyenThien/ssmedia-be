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

  public async getReportProfiles(skip: number, limit: number): Promise<any[]> {
    // 1. Lấy reportProfiles phân trang
    const reportProfiles: IReportProfileDocument[] = await ReportProfileModel.find().skip(skip).limit(limit).exec();

    // 2. Dùng Promise.all để gọi song song lấy user info cho reporter và reportedUser
    const results = await Promise.all(
      reportProfiles.map(async (report) => {
        const reportedUser = await userService.getUserById(report.reportedUserId.toString());
        const reporter = await userService.getUserById(report.reporterId.toString());

        return {
          ...report.toObject(),
          reportedUser,
          reporter
        };
      })
    );

    return results;
  }

  public async updateReportProfileStatus(
    reportId: string,
    status: 'pending' | 'reviewed' | 'resolved'
  ): Promise<IReportProfileDocument | null> {
    const updatedReport = await ReportProfileModel.findByIdAndUpdate(reportId, { status }, { new: true });

    return updatedReport;
  }
}

export const reportProfileService: ReportProfileService = new ReportProfileService();
