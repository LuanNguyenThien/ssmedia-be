import { DoneCallback, Job } from 'bull';
import Logger from 'bunyan';
import { config } from '@root/config';
import { favPostService } from '@service/db/fav-post.service';
import { IFavPostDocument } from '@favorite-posts/interfaces/fav-post.interface';

const log: Logger = config.createLogger('addFavPostWorker');

class FavPostWorker {
  public async addFavPostToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const  data: IFavPostDocument  = job.data;
      await favPostService.addFavPost(data);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);  
      done(error as Error);
    }
  }

  public async removeFavPostFromDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { userId, postId } = job.data;
      await favPostService.removeFavPost(userId, postId);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }
}

export const favPostWorker = new FavPostWorker();