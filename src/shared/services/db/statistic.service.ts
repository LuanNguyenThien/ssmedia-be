import { ObjectId } from 'mongodb';
import { IGetPostsQuery, IPostDocument } from '@post/interfaces/post.interface';
import { ReportPostModel } from '@report-posts/models/report-post.schema';
import { IReportPostDocument } from '@report-posts/interfaces/report-post.interface';
import { PostModel } from '@post/models/post.schema';
import { postService } from './post.service';

class StatisticService {
  public async countPostsPerDay(): Promise<any[]> {
    return PostModel.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalPosts: { $sum: 1 },
          hiddenPosts: {
            $sum: { $cond: ['$isHidden', 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  }
}

export const statisticService: StatisticService = new StatisticService();
