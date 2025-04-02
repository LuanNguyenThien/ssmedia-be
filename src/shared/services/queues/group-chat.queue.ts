import { IGroupChat, IGroupChatDocument, IGroupChatJob } from '@chat/interfaces/group-chat.interface';
import { BaseQueue } from '@service/queues/base.queue';
import { groupChatWorker } from '@worker/group-chat.worker';

class GroupChatQueue extends BaseQueue {
  private static instance: GroupChatQueue;
  constructor() {
    super('groupChats');
    this.processJob('createGroupChat', 5, groupChatWorker.createGroupChatToDB);
    this.processJob('addMemberGroupChat', 5, groupChatWorker.addGroupChatMemberToDB);
    this.processJob('addMembersGroupChat', 5, groupChatWorker.addGroupChatMembersToDB);
    // this.processJob('addMessageToGroupChat', 5, groupChatWorker.addMessageToGroupChat);
    // this.processJob('updateGroupChat', 5, groupChatWorker.updateGroupChatToDB);
    // this.processJob('deleteGroupChat', 5, groupChatWorker.deleteGroupChat);
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