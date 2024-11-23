import { IReportPostDocument } from '@report-posts/interfaces/report-post.interface';
import { BaseQueue } from '@service/queues/base.queue';
import { reportPostWorker } from '@worker/reportport.worker';

class ReportPostQueue extends BaseQueue {
  private static instance: ReportPostQueue;
  constructor() {
    super('reportPosts');
    this.processJob('addreportPostToDB', 5, reportPostWorker.addReportPostToDB);
  }

  public static getInstance(): ReportPostQueue {
    if (!ReportPostQueue.instance) {
      ReportPostQueue.instance = new ReportPostQueue();
    }
    return ReportPostQueue.instance;
  }

  public addReportPostJob(name: string, data: IReportPostDocument): void {
    this.addJob(name, data);
  }
}

export const reportPostQueue: ReportPostQueue = ReportPostQueue.getInstance();
