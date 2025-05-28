import { DoneCallback, Job } from 'bull';
import Logger from 'bunyan';
import { config } from '@root/config';
import { userService } from '@service/db/user.service';
import { textServiceAI } from '@api-serverAI/text/text.AIservice';
import { UserModel } from '@user/models/user.schema';
import { cache } from '@service/redis/cache';

const postCache = cache.postCache;
const log: Logger = config.createLogger('userWorker');

class UserWorker {
  async addUserToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { value } = job.data;
      await userService.addUserData(value);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }

  async updateUserInfo(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key, value } = job.data;
      await userService.updateUserInfo(key, value);

      if (value.quote || value.school || value.work || value.location)  {
        try {
          const user = job.data.value;
          const combinedText = `${user.quote || ''}. ${user.school || ''}. ${user.work || ''}. ${user.location|| ''}` ;
          const response = await textServiceAI.vectorizeText({ query: combinedText });
          // const vectorizedData = response.vector;
          const preprocessedQuery = response.preprocessed_query;
          await UserModel.updateOne(
            { _id: key },
            { $set: { user_vector: [], "user_hobbies.personal": preprocessedQuery } }
          );
          await postCache.clearPersonalizedPostsCache(key);
        } catch (error) {
          log.error(`Error vectorizing data for user ${key}: ${(error as Error).message}`);
        }
      }
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }

  async updateUserHobbies(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key, value } = job.data;
      await userService.updateUserHobbies(key, value);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }

  async updateSocialLinks(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key, value } = job.data;
      await userService.updateSocialLinks(key, value);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }

  async updateNotificationSettings(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key, value } = job.data;
      await userService.updateNotificationSettings(key, value);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }
}

export const userWorker: UserWorker = new UserWorker();
