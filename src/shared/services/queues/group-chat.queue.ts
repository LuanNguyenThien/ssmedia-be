import { IGroupChat, IGroupChatDocument, IGroupChatJob } from '@root/features/group-chat/interfaces/group-chat.interface';
import { BaseQueue } from '@service/queues/base.queue';
import { groupChatWorker } from '@worker/group-chat.worker';

class GroupChatQueue extends BaseQueue {
  private static instance: GroupChatQueue;
  constructor() {
    super('groupChats');
    this.processJob('createGroupChat', 5, groupChatWorker.createGroupChatToDB);
    this.processJob('addMemberGroupChat', 5, groupChatWorker.addGroupChatMemberToDB);
    this.processJob('addMembersGroupChat', 5, groupChatWorker.addGroupChatMembersToDB);
    this.processJob('updateGroupAvatarInDB', 5, groupChatWorker.updateGroupAvatarInDB);
    this.processJob('updateGroupInfoInDB', 5, groupChatWorker.updateGroupInfoInDB);
    this.processJob('removeGroupMemberInDB', 5, groupChatWorker.removeGroupMemberInDB);
    this.processJob('updateMemberStateInDB', 5, groupChatWorker.updateMemberStateInDB);
    this.processJob('updateMemberRoleInDB', 5, groupChatWorker.updateMemberRoleInDB);
    this.processJob('deleteGroupInDB', 5, groupChatWorker.deleteGroupInDB);
  }

  public static getInstance(): GroupChatQueue {
    if (!GroupChatQueue.instance) {
      GroupChatQueue.instance = new GroupChatQueue();
    }
    return GroupChatQueue.instance;
  }

  public addGroupChatJob(name: string, data: IGroupChatJob | IGroupChat | IGroupChatDocument): void {
    this.addJob(name, data);
  }
}

export const groupChatQueue: GroupChatQueue = GroupChatQueue.getInstance();