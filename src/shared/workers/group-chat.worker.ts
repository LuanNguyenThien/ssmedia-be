import { DoneCallback, Job } from 'bull';
import Logger from 'bunyan';
import { config } from '@root/config';
import { groupChatService } from '@service/db/group-chat.service';
import { IGroupChat, IGroupChatJob, IGroupChatMember, IGroupChatMemberDocument } from '@root/features/group-chat/interfaces/group-chat.interface';
import { imageService } from '@service/db/image.service';
import { IGroupDocument } from '@root/features/group/interfaces/group.interface';
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

  async updateGroupAvatarInDB(job: Job): Promise<void> {
    try {
      const { groupChatId, avatar, imgId, imgVersion } = job.data;

      // Update the group avatar in database
      await groupChatService.updateGroupChat(groupChatId, { profilePicture: avatar });

      // Store the avatar image in the image collection
      await imageService.addGroupAvatarImageToDB(groupChatId, avatar, imgId, imgVersion);
    } catch (error) {
      console.log(error);
    }
  }

  async updateGroupInfoInDB(job: Job): Promise<void> {
    try {
      const { groupChatId, updateData } = job.data;
      await groupChatService.updateGroupChat(groupChatId, updateData);
    } catch (error) {
      console.log(error);
    }
  }

  async removeGroupMemberInDB(job: Job): Promise<void> {
    try {
      const { groupChatId, userId } = job.data;
      await groupChatService.removeGroupChatMember(groupChatId, userId);
    } catch (error) {
      console.log(error);
    }
  }

  async updateMemberStateInDB(job: Job): Promise<void> {
    try {
      const { groupChatId, userId, state } = job.data;
      await groupChatService.updateMemberState(groupChatId, userId, state);
    } catch (error) {
      console.log(error);
    }
  }

  async updateMemberRoleInDB(job: Job): Promise<void> {
    try {
      const { groupChatId, userId, role } = job.data;
      // Use the dedicated method that only updates the role of the specific member
      await groupChatService.updateMemberRole(groupChatId, userId, role);
    } catch (error) {
      console.log(error);
    }
  }

  async deleteGroupInDB(job: Job): Promise<void> {
    try {
      const { groupChatId } = job.data;
      await groupChatService.deleteGroupChat(groupChatId);
    } catch (error) {
      console.log(error);
    }
  }

  public async saveGroup(group: IGroupDocument): Promise<IGroupDocument> {
    return await group.save();
  }
}

export const groupChatWorker: GroupChatWorker = new GroupChatWorker();