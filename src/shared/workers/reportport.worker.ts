import { DoneCallback, Job } from 'bull';
import Logger from 'bunyan';
import { config } from '@root/config';
import { reportPostService } from '@service/db/report-post.service';
import { IReportPostDocument } from '@report-posts/interfaces/report-post.interface';

const log: Logger = config.createLogger('addFavPostWorker');

class ReportPostWorker {
  public async addReportPostToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const data: IReportPostDocument = job.data;
      await reportPostService.addReportPost(data);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }

 
}

export const reportPostWorker = new ReportPostWorker();
