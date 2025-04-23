import { ObjectId } from 'mongodb';
import { IGetPostsQuery, IPostDocument } from '@post/interfaces/post.interface';
import { ReportPostModel } from '@report-posts/models/report-post.schema';
import { IReportPostDocument } from '@report-posts/interfaces/report-post.interface';
import { PostModel } from '@post/models/post.schema';
import { postService } from './post.service';

class ReportPostService {
  // Thêm bài viết vào danh sách yêu thích
  public async addReportPost(reportPostData: IReportPostDocument): Promise<IReportPostDocument> {
    const { userId, postId, content, details } = reportPostData;

    // Kiểm tra xem bài viết đã có trong danh sách yêu thích chưa
    // const existingReport = await ReportPostModel.findOne({ userId, postId });

    // if (existingReport) {
    //   // Nếu đã có, gọi phương thức bỏ yêu thích
    //   // await this.removeFavPost(userId, postId);
    //   return existingReport; // Trả về bài viết đã bỏ yêu thích
    // }

    // Nếu chưa có, tạo mới bài viết yêu thích
    return await ReportPostModel.create(reportPostData);
  }

  public async getReportPosts(skip: number, limit: number): Promise<any[]> {
    const reportPosts: IReportPostDocument[] = await ReportPostModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

    const postIds: ObjectId[] = reportPosts.map((report) => new ObjectId(report.postId));

    const posts: IPostDocument[] = await PostModel.find({ _id: { $in: postIds } }).lean();

    const postMap = new Map(posts.filter((post) => post._id).map((post) => [post._id!.toString(), post]));

    const combined = reportPosts.map((report) => ({
      report,
      post: postMap.get(report.postId.toString()) || null
    }));

    return combined;
  }

  public async updateReportPostStatus(reportId: string, status: 'pending' | 'reviewed' | 'resolved'): Promise<IReportPostDocument> {
    if (!reportId) {
      throw new Error('Missing reportId');
    }

    const updatedReport = await ReportPostModel.findByIdAndUpdate(reportId, { status }, { new: true });

    if (!updatedReport) {
      throw new Error(`Report with ID ${reportId} not found`);
    }

    return updatedReport;
  }
}

export const reportPostService: ReportPostService = new ReportPostService();
