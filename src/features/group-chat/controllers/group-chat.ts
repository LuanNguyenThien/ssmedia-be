import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { BadRequestError } from '@global/helpers/error-handler';
import { IGroupChat, IGroupChatDocument, IGroupChatMember } from '@root/features/group-chat/interfaces/group-chat.interface';
import { UploadApiResponse } from 'cloudinary';
import { uploads } from '@global/helpers/cloudinary-upload';
import { IMessageData } from '@chat/interfaces/chat.interface';
import { socketIOChatObject } from '@socket/chat';
import { cache } from '@service/redis/cache';
import { groupChatQueue } from '@service/queues/group-chat.queue';
import { groupChatService } from '@service/db/group-chat.service';
import { chatQueue } from '@service/queues/chat.queue';
import { createGroupChatSchema, updateGroupChatSchema, addMembersSchema } from '@root/features/group-chat/schemes/group-chat.schemes';
import { addImageSchema } from '@image/schemes/images';

const userCache = cache.userCache;
const messageCache = cache.messageCache;
const groupMessageCache = cache.groupMessageCache;

export class GroupChat {
  public async getAllGroupChats(req: Request, res: Response): Promise<void> {
    const groupChats: IGroupChatDocument[] = await groupChatService.getAllGroupChats();
    res.status(HTTP_STATUS.OK).json({ message: 'All group chats', groupChats });
  }

  @joiValidation(createGroupChatSchema)
  public async create(req: Request, res: Response): Promise<void> {
    const { name, description, members } = req.body;

    const groupPicture = !req.body.groupPicture ? 'https://www.tenniscall.com/images/chat.jpg' : req.body.groupPicture;
    const membersList: IGroupChatMember[] = [];

    const currentUser = await userCache.getUserFromCache(`${req.currentUser!.userId}`);
    membersList.push({
      userId: `${req.currentUser!.userId}`,
      username: `${req.currentUser!.username}`,
      avatarColor: `${req.currentUser!.avatarColor}`,
      profilePicture: currentUser?.profilePicture || '',
      role: 'admin',
      state: 'accepted',
      createdAt: new Date()
    });

    // Add other members
    for (const memberId of members) {
      if (memberId !== req.currentUser!.userId) {
        const user = await userCache.getUserFromCache(`${memberId}`);
        if (user) {
          membersList.push({
            userId: `${memberId}`,
            username: user.username as string,
            avatarColor: user.avatarColor as string,
            profilePicture: user.profilePicture || '',
            role: 'member',
            state: 'pending',
            createdAt: new Date()
          });
        }
      }
    }

    const groupId = new ObjectId();
    const groupChatData: IGroupChat = {
      _id: `${groupId}`,
      name,
      description,
      profilePicture: groupPicture,
      members: membersList,
      createdBy: `${req.currentUser!.userId}`,
      createdAt: new Date()
    };

    await groupMessageCache.createGroupChat(groupChatData);
    groupChatQueue.addGroupChatJob('createGroupChat', groupChatData);
    for (const member of membersList) {
      await messageCache.addChatListToCache(member.userId, `${groupId}`, `${groupId}`, 'group');
    }
    socketIOChatObject.emit('new group created', groupChatData);

    res.status(HTTP_STATUS.CREATED).json({ message: 'Group created successfully', group: groupChatData });
  }

  public async getGroupChat(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;

    // Try to get group from cache first
    let group = await groupMessageCache.getGroupChat(groupId);

    // If empty object or incomplete data from cache, get from DB
    if (!group || !Object.keys(group).length) {
      group = await groupChatService.getGroupChatById(groupId);

      // If group exists in DB but not in cache, update the cache
      if (group) {
        await groupMessageCache.updateGroupInfo(groupId, group);
      }
    }

    if (!group) {
      throw new BadRequestError('Group not found');
    }

    res.status(HTTP_STATUS.OK).json({ message: 'Group chat info', group });
  }

  public async getUserGroups(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    // Ideally, we could get this from cache, but for now we'll use the database
    const groups: IGroupChatDocument[] = await groupChatService.getGroupChatByMemberId(userId);
    res.status(HTTP_STATUS.OK).json({ message: 'User group chats', groups });
  }

  @joiValidation(updateGroupChatSchema)
  public async updateGroupInfo(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const { name, description } = req.body;

    // Check if group exists - try cache first
    let group = await groupMessageCache.getGroupChat(groupId);
    if (!group || !Object.keys(group).length) {
      group = await groupChatService.getGroupChatById(groupId);
      if (!group) {
        throw new BadRequestError('Group not found');
      }
    }

    const currentUserMember = group.members.find((member) => `${member.userId}` === `${req.currentUser!.userId}`);
    if (!currentUserMember || currentUserMember.role !== 'admin') {
      throw new BadRequestError('Only admins can update group information');
    }

    // Handle profile picture upload if provided
    let groupPicture = '';
    if (req.body.groupPicture) {
      const result: UploadApiResponse = (await uploads(req.body.groupPicture)) as UploadApiResponse;
      if (!result?.public_id) {
        throw new BadRequestError(result.message);
      }
      groupPicture = `https://res.cloudinary.com/di6ozapw8/image/upload/v${result.version}/${result.public_id}`;
    }

    // Update group info
    const updateData: Partial<IGroupChatDocument> = {
      name: name || group.name,
      description: description !== undefined ? description : group.description
    };

    if (groupPicture) {
      updateData.profilePicture = groupPicture;
    }

    // Update cache first
    await groupMessageCache.updateGroupInfo(groupId, updateData);

    // Queue job for DB update
    groupChatQueue.addGroupChatJob('updateGroupInfoInDB', {
      groupChatId: groupId,
      updateData
    });

    // Get updated group from cache
    const updatedGroup = await groupMessageCache.getGroupChat(groupId);

    // Notify members
    socketIOChatObject.emit('group updated', updatedGroup);

    res.status(HTTP_STATUS.OK).json({ message: 'Group updated successfully', group: updatedGroup });
  }

  @joiValidation(addMembersSchema)
  public async addMembers(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const { members } = req.body;

    // Check if group exists - try cache first
    let group = await groupMessageCache.getGroupChat(groupId);
    if (!group || !Object.keys(group).length) {
      group = await groupChatService.getGroupChatById(groupId);
      if (!group) {
        throw new BadRequestError('Group not found');
      }
      // Update cache with DB data
      if (group) {
        await groupMessageCache.updateGroupInfo(groupId, group);
      }
    }

    // Check if user is admin
    const currentUserMember = group.members.find((member) => `${member.userId}` === `${req.currentUser!.userId}`);
    if (!currentUserMember || currentUserMember.role !== 'admin') {
      throw new BadRequestError('Only admins can add members');
    }

    // Create member objects for new members
    const newMembersList: IGroupChatMember[] = [];
    const existingMemberIds = new Set(group.members.map((member) => member.userId));

    for (const memberId of members) {
      if (!existingMemberIds.has(memberId)) {
        const user = await userCache.getUserFromCache(`${memberId}`);
        if (user) {
          newMembersList.push({
            userId: `${memberId}`,
            username: user.username as string,
            avatarColor: user.avatarColor as string,
            profilePicture: user.profilePicture || '',
            role: 'member',
            state: 'pending',
            createdAt: new Date()
          });
        }
      }
    }

    if (newMembersList.length === 0) {
      throw new BadRequestError('No new members to add');
    }

    // Update cache first for immediate feedback
    for (const member of newMembersList) {
      await groupMessageCache.addMemberToGroup(groupId, member);
      await messageCache.addChatListToCache(member.userId, groupId, groupId, 'group');
    }

    // Convert userId from string to ObjectId for each new member (for DB operations)
    const newMembersListWithObjectId = newMembersList.map((member) => ({
      ...member,
      userId: member.userId
    }));

    // Queue job for DB update
    groupChatQueue.addGroupChatJob('addMembersGroupChat', {
      groupChatId: groupId,
      groupChatMembers: newMembersListWithObjectId
    });

    // Fetch the updated group from cache to confirm changes are reflected
    const updatedGroup = await groupMessageCache.getGroupChat(groupId);

    // Notify all members
    socketIOChatObject.emit('group members added', {
      groupId,
      newMembers: newMembersList,
      group: updatedGroup
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Members added to group successfully',
      newMembers: newMembersList,
      group: updatedGroup
    });
  }

  public async removeMember(req: Request, res: Response): Promise<void> {
    const { groupId, memberId } = req.params;

    // Get group from cache or DB
    let group = await groupMessageCache.getGroupChat(groupId);
    if (!group || !Object.keys(group).length) {
      group = await groupChatService.getGroupChatById(groupId);
      if (!group) {
        throw new BadRequestError('Group not found');
      }
    }

    // Check if current user is admin or the user removing themselves
    const isCurrentUserAdmin = group.members.some(
      (member) => `${member.userId}` === `${req.currentUser!.userId}` && member.role === 'admin'
    );
    const isSelfRemoval = memberId === req.currentUser!.userId;

    if (!isCurrentUserAdmin && !isSelfRemoval) {
      throw new BadRequestError('You do not have permission to remove this member');
    }

    // Check if member exists in group
    const memberIndex = group.members.findIndex((member) => `${member.userId}` === `${memberId}`);
    if (memberIndex === -1) {
      throw new BadRequestError('Member not found in group');
    }

    // Check if member is admin and there's only one admin
    const memberToRemove = group.members[memberIndex];
    if (memberToRemove.role === 'admin') {
      const adminCount = group.members.filter((member) => member.role === 'admin').length;
      if (adminCount === 1) {
        throw new BadRequestError('Cannot remove the only admin from the group');
      }
    }

    // Update cache first
    await groupMessageCache.removeMemberFromGroup(groupId, memberId);

    // Queue job for DB update
    groupChatQueue.addGroupChatJob('removeGroupMemberInDB', {
      groupChatId: groupId,
      userId: memberId
    });

    // Send notifications
    socketIOChatObject.emit('group member removed', {
      groupId,
      memberId
    });

    // Add system message about member leaving/being removed
    const messageData: IMessageData = {
      _id: `${new mongoose.Types.ObjectId()}`,
      conversationId: undefined,
      receiverId: undefined,
      receiverUsername: undefined,
      receiverAvatarColor: undefined,
      receiverProfilePicture: undefined,
      senderUsername: 'System',
      senderId: 'system', // Changed from ObjectId to consistently use 'system' string
      senderAvatarColor: '#000000',
      senderProfilePicture: '',
      body: isSelfRemoval ? `${memberToRemove.username} left the group` : `${memberToRemove.username} was removed from the group`,
      isRead: true,
      gifUrl: '',
      selectedImage: '',
      reaction: [],
      createdAt: new Date(),
      deleteForMe: false,
      deleteForEveryone: false,
      isGroupChat: true,
      groupId: groupId
    };

    await groupMessageCache.addGroupChatMessageToCache(groupId, messageData);
    chatQueue.addChatJob('addChatMessageToDB', messageData);

    res.status(HTTP_STATUS.OK).json({
      message: isSelfRemoval ? 'You left the group' : 'Member removed successfully'
    });
  }

  public async promoteToAdmin(req: Request, res: Response): Promise<void> {
    const { groupId, memberId } = req.params;

    // Get group from cache or DB
    let group = await groupMessageCache.getGroupChat(groupId);
    if (!group || !Object.keys(group).length) {
      group = await groupChatService.getGroupChatById(groupId);
      if (!group) {
        throw new BadRequestError('Group not found');
      }
    }

    // Check if current user is admin
    const isCurrentUserAdmin = group.members.some(
      (member) => `${member.userId}` === `${req.currentUser!.userId}` && member.role === 'admin'
    );

    if (!isCurrentUserAdmin) {
      throw new BadRequestError('Only admins can promote members');
    }

    // Check if member is pending
    const isPendingMember = group.members.some((member) => `${member.userId}` === `${memberId}` && member.state === 'pending');
    if (isPendingMember) {
      throw new BadRequestError('Cannot promote a member with pending status');
    }

    // Check if member exists and is not already an admin
    const memberToPromote = group.members.find((member) => `${member.userId}` === `${memberId}`);
    if (!memberToPromote) {
      throw new BadRequestError('Member not found in group');
    }

    if (memberToPromote.role === 'admin') {
      throw new BadRequestError('Member is already an admin');
    }

    // Update cache first
    await groupMessageCache.updateMemberRole(groupId, memberId, 'admin');

    // Queue job for DB update
    groupChatQueue.addGroupChatJob('updateMemberRoleInDB', {
      groupChatId: groupId,
      userId: memberId,
      role: 'admin'
    });

    // Notify members
    socketIOChatObject.emit('group member promoted', {
      groupId,
      memberId,
      username: memberToPromote.username
    });

    // Add system message about promotion
    const messageData: IMessageData = {
      _id: `${new mongoose.Types.ObjectId()}`,
      conversationId: undefined,
      receiverId: undefined,
      receiverUsername: undefined,
      receiverAvatarColor: undefined,
      receiverProfilePicture: undefined,
      senderUsername: 'System',
      senderId: `${new mongoose.Types.ObjectId()}`,
      senderAvatarColor: '#000000',
      senderProfilePicture: '',
      body: `${memberToPromote.username} is now an admin`,
      isRead: true,
      gifUrl: '',
      selectedImage: '',
      reaction: [],
      createdAt: new Date(),
      deleteForMe: false,
      deleteForEveryone: false,
      isGroupChat: true,
      groupId: groupId
    };

    await groupMessageCache.addGroupChatMessageToCache(groupId, messageData);
    chatQueue.addChatJob('addChatMessageToDB', messageData);

    res.status(HTTP_STATUS.OK).json({
      message: 'Member promoted to admin successfully'
    });
  }

  public async deleteGroup(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;

    // Get group from cache or DB
    let group = await groupMessageCache.getGroupChat(groupId);
    if (!group || !Object.keys(group).length) {
      group = await groupChatService.getGroupChatById(groupId);
      if (!group) {
        throw new BadRequestError('Group not found');
      }
    }

    // Check if current user is admin
    const isCurrentUserAdmin = group.members.some(
      (member) => `${member.userId}` === `${req.currentUser!.userId}` && member.role === 'admin'
    );

    if (!isCurrentUserAdmin) {
      throw new BadRequestError('Only admins can delete the group');
    }

    // Delete from cache first
    await groupMessageCache.deleteGroupFromCache(groupId);

    // Queue job for DB delete
    groupChatQueue.addGroupChatJob('deleteGroupInDB', {
      groupChatId: groupId
    });

    // Notify members
    socketIOChatObject.emit('group deleted', {
      groupId,
      members: group.members
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Group deleted successfully'
    });
  }

  public async getUserPendingInvitations(req: Request, res: Response): Promise<void> {
    const userId = req.currentUser!.userId;
    try {
      // 1. Try to get pending group IDs from cache
      const pendingGroups: IGroupChatDocument[] = await groupChatService.getUserPendingGroups(userId);
      // 4. Return result
      res.status(HTTP_STATUS.OK).json({
        message: 'User pending group invitations',
        pendingGroups
      });
    } catch {
      throw new BadRequestError('Failed to get pending invitations');
    }
  }

  public async acceptGroupInvitation(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const userId = req.currentUser!.userId;

    // Get group from cache or DB
    let group = await groupMessageCache.getGroupChat(groupId);
    if (!group || !Object.keys(group).length) {
      group = await groupChatService.getGroupChatById(groupId);
      if (!group) {
        throw new BadRequestError('Group not found');
      }
    }

    // Check if user is in the group with pending state
    const memberIndex = group.members.findIndex((member) => `${member.userId}` === `${userId}` && member.state === 'pending');

    if (memberIndex === -1) {
      throw new BadRequestError('No pending invitation found for this group');
    }

    // Update member state to accepted in cache
    await groupMessageCache.updateMemberState(groupId, userId, 'accepted');

    // Queue job to update DB
    groupChatQueue.addGroupChatJob('updateMemberStateInDB', {
      groupChatId: groupId,
      userId,
      state: 'accepted'
    });

    // Add system message about member accepting invitation
    const memberUsername = group.members[memberIndex].username;
    const messageData: IMessageData = {
      _id: `${new mongoose.Types.ObjectId()}`,
      conversationId: undefined,
      receiverId: undefined,
      receiverUsername: undefined,
      receiverAvatarColor: undefined,
      receiverProfilePicture: undefined,
      senderUsername: 'System',
      senderId: `${new mongoose.Types.ObjectId()}`,
      senderAvatarColor: '#000000',
      senderProfilePicture: '',
      body: `${memberUsername} joined the group`,
      isRead: true,
      gifUrl: '',
      selectedImage: '',
      reaction: [],
      createdAt: new Date(),
      deleteForMe: false,
      deleteForEveryone: false,
      isGroupChat: true,
      groupId: groupId
    };

    await groupMessageCache.addGroupChatMessageToCache(groupId, messageData);
    chatQueue.addChatJob('addChatMessageToDB', messageData);

    // Notify all members
    socketIOChatObject.emit('group invitation accepted', {
      groupId,
      userId,
      username: memberUsername
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Group invitation accepted successfully'
    });
  }

  public async declineGroupInvitation(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const userId = req.currentUser!.userId;

    // Get group from cache or DB
    let group = await groupMessageCache.getGroupChat(groupId);
    if (!group || !Object.keys(group).length) {
      group = await groupChatService.getGroupChatById(groupId);
      if (!group) {
        throw new BadRequestError('Group not found');
      }
    }

    // Check if user is in the group with pending state
    const memberIndex = group.members.findIndex((member) => `${member.userId}` === `${userId}` && member.state === 'pending');

    if (memberIndex === -1) {
      throw new BadRequestError('No pending invitation found for this group');
    }

    // Update member state to declined in cache
    await groupMessageCache.updateMemberState(groupId, userId, 'declined');

    // Queue job to update DB
    groupChatQueue.addGroupChatJob('updateMemberStateInDB', {
      groupChatId: groupId,
      userId,
      state: 'declined'
    });

    // Notify admins
    const adminMembers = group.members.filter((member) => member.role === 'admin');
    socketIOChatObject.emit('group invitation declined', {
      groupId,
      userId,
      username: group.members[memberIndex].username,
      admins: adminMembers.map((admin) => admin.userId)
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Group invitation declined successfully'
    });
  }

  public async leaveGroup(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const userId = req.currentUser!.userId;

    // Get group from cache or DB
    let group = await groupMessageCache.getGroupChat(groupId);
    if (!group || !Object.keys(group).length) {
      group = await groupChatService.getGroupChatById(groupId);
      if (!group) {
        throw new BadRequestError('Group not found');
      }
    }

    // Check if user is a member of the group
    const memberIndex = group.members.findIndex((member) => `${member.userId}` === userId);
    if (memberIndex === -1) {
      throw new BadRequestError('You are not a member of this group');
    }

    const memberToRemove = group.members[memberIndex];

    // Check if user is the only admin
    if (memberToRemove.role === 'admin') {
      const adminCount = group.members.filter((member) => member.role === 'admin').length;
      if (adminCount === 1) {
        throw new BadRequestError(
          'As the only admin, you cannot leave the group. Please promote another member to admin first or delete the group.'
        );
      }
    }

    // Update cache
    await groupMessageCache.removeMemberFromGroup(groupId, userId);

    // Queue job to update DB
    groupChatQueue.addGroupChatJob('removeGroupMemberInDB', {
      groupChatId: groupId,
      userId
    });

    // Add system message about member leaving
    const messageData: IMessageData = {
      _id: `${new mongoose.Types.ObjectId()}`,
      conversationId: undefined,
      receiverId: undefined,
      receiverUsername: undefined,
      receiverAvatarColor: undefined,
      receiverProfilePicture: undefined,
      senderUsername: 'System',
      senderId: `${new mongoose.Types.ObjectId()}`,
      senderAvatarColor: '#000000',
      senderProfilePicture: '',
      body: `${memberToRemove.username} left the group`,
      isRead: true,
      gifUrl: '',
      selectedImage: '',
      reaction: [],
      createdAt: new Date(),
      deleteForMe: false,
      deleteForEveryone: false,
      isGroupChat: true,
      groupId: groupId
    };

    await groupMessageCache.addGroupChatMessageToCache(groupId, messageData);
    chatQueue.addChatJob('addChatMessageToDB', messageData);

    // Notify members
    socketIOChatObject.emit('group member left', {
      groupId,
      userId,
      username: memberToRemove.username
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'You have left the group successfully'
    });
  }

  @joiValidation(addImageSchema)
  public async updateGroupAvatar(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;

    // Check if group exists
    const group = await groupChatService.getGroupChatById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    // Check if user is a member of the group
    const currentUserMember = group.members.find((member) => `${member.userId}` === `${req.currentUser!.userId}`);
    if (!currentUserMember) {
      throw new BadRequestError('You are not a member of this group');
    }

    // Only admin can update group avatar
    if (currentUserMember.role !== 'admin') {
      throw new BadRequestError('Only admins can update group avatar');
    }

    const result: UploadApiResponse = (await uploads(req.body.image, groupId, true, true)) as UploadApiResponse;
    if (!result?.public_id) {
      throw new BadRequestError('File upload: Error occurred. Try again.');
    }

    const url = `https://res.cloudinary.com/di6ozapw8/image/upload/v${result.version}/${result.public_id}?t=${new Date().getTime()}`;

    // Update group avatar in cache
    await groupMessageCache.updateGroupAvatar(groupId, url);

    // Notify members of group avatar change
    socketIOChatObject.emit('group avatar updated', {
      groupId,
      avatar: url
    });

    // Queue job to update database
    groupChatQueue.addGroupChatJob('updateGroupAvatarInDB', {
      groupChatId: groupId,
      avatar: url,
      imgId: result.public_id,
      imgVersion: result.version.toString()
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Group avatar updated successfully' });
  }

  public async checkUserInGroup(req: Request, res: Response): Promise<void> {
    const { groupId, userId } = req.params;
    // Try to get group from cache first
    const group = await groupChatService.getGroupChatById(groupId);
  
    const member = group.members.find((m) => `${m.userId}` === `${userId}`);
    if (!member) {
      throw new BadRequestError('You are not a member of this group');
    }    
    // Add check for user state
    if (member.state !== 'accepted') {
      throw new BadRequestError('Your membership request is still pending or has been declined');
    }
    
    res.status(HTTP_STATUS.OK).json({ message: 'User is a member of the group', group, member });
  }
}
