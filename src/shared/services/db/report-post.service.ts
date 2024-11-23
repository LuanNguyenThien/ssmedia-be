import { ObjectId } from 'mongodb';
import { IGetPostsQuery, IPostDocument } from '@post/interfaces/post.interface';
import { ReportPostModel } from '@report-posts/models/report-post.schema';
import { IReportPostDocument } from '@report-posts/interfaces/report-post.interface';
import { PostModel } from '@post/models/post.schema';
import { postService } from './post.service';


class ReportPostService {
  // Thêm bài viết vào danh sách yêu thích
  public async addReportPost(reportPostData: IReportPostDocument): Promise<IReportPostDocument> {
    const { userId, postId } = reportPostData;

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

  public async getReportPosts( skip: number, limit: number): Promise<IPostDocument[]> {
    // Lấy danh sách các bài post yêu thích từ bảng FavPostModel
    const reportPosts: IReportPostDocument[] = await ReportPostModel.find().exec();
    const postIds: string[] = reportPosts.map((reportPost) => reportPost.postId);
    // Sử dụng hàm getPosts để lấy thông tin chi tiết của các bài post
    const posts: IPostDocument[] = await postService.getPosts({ _id: { $in: postIds } }, skip, limit, { createAt: -1 });
    return posts;
  }
}

export const reportPostService: ReportPostService = new ReportPostService();
