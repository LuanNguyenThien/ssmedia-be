import { DoneCallback, Job } from 'bull';
import Logger from 'bunyan';
import { config } from '@root/config';
import { groupChatService } from '@service/db/group-chat.service';

const log: Logger = config.createLogger('group-chatWorker');

class GroupChatWorker {
  async createGroupChatToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      await groupChatService.createGroupChat(job.data);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }
  async addGroupChatMemberToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { groupChatId, groupChatMember } = job.data;
      await groupChatService.addGroupChatMember(groupChatId, groupChatMember);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }
  async addGroupChatMembersToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { groupChatId, groupChatMembers } = job.data;
      await groupChatService.addGroupChatMembers(groupChatId, groupChatMembers);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }
}

export const groupChatWorker: GroupChatWorker = new GroupChatWorker();