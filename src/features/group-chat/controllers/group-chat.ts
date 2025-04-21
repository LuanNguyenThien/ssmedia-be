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

const userCache = cache.userCache;
const messageCache = cache.messageCache;
const groupMessageCache = cache.groupMessageCache;

export class GroupChat {
  @joiValidation(createGroupChatSchema)
  public async create(req: Request, res: Response): Promise<void> {
    const { name, description, members } = req.body;
    let groupPicture = '';

    if (req.body.groupPicture) {
      const result: UploadApiResponse = (await uploads(req.body.groupPicture)) as UploadApiResponse;
      if (!result?.public_id) {
        throw new BadRequestError(result.message);
      }
      groupPicture = `https://res.cloudinary.com/di6ozapw8/image/upload/v${result.version}/${result.public_id}`;
    }

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
    const group: IGroupChatDocument = await groupChatService.getGroupChatById(groupId);
    res.status(HTTP_STATUS.OK).json({ message: 'Group chat info', group });
  }

  public async getUserGroups(req: Request, res: Response): Promise<void> {
    const userId = req.currentUser!.userId;
    const groups: IGroupChatDocument[] = await groupChatService.getGroupChatByMemberId(userId);
    res.status(HTTP_STATUS.OK).json({ message: 'User group chats', groups });
  }

  @joiValidation(updateGroupChatSchema)
  public async updateGroupInfo(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const { name, description } = req.body;

    // Check if user is admin
    const group = await groupChatService.getGroupChatById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
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

    const updatedGroup = await groupChatService.updateGroupChat(groupId, updateData);

    // Update cache
    await groupMessageCache.getGroupChat(groupId); // Refresh cache

    // Notify members
    socketIOChatObject.emit('group updated', updatedGroup);

    res.status(HTTP_STATUS.OK).json({ message: 'Group updated successfully', group: updatedGroup });
  }

  @joiValidation(addMembersSchema)
  public async addMembers(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const { members } = req.body;

    // Check if group exists
    const group = await groupChatService.getGroupChatById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
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

    // Convert userId from string to ObjectId for each new member
    const newMembersListWithObjectId = newMembersList.map((member) => ({
      ...member,
      userId: new ObjectId(member.userId)
    }));

    // Add members to group
    const updatedGroup = await groupChatService.addGroupChatMembers(groupId, newMembersListWithObjectId);

    // Update cache and add to members' chat lists
    for (const member of newMembersList) {
      await messageCache.addChatListToCache(member.userId, groupId, groupId, 'group');
    }

    // Queue job for DB update
    groupChatQueue.addGroupChatJob('addMembersGroupChat', {
      groupChatId: groupId,
      groupChatMembers: newMembersList
    });

    // Notify all members
    socketIOChatObject.emit('group members added', {
      groupId,
      newMembers: newMembersList
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Members added to group successfully',
      newMembers: newMembersList
    });
  }

  public async removeMember(req: Request, res: Response): Promise<void> {
    const { groupId, memberId } = req.params;

    // Check if group exists
    const group = await groupChatService.getGroupChatById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    // Check if current user is admin or the user removing themselves
    const isCurrentUserAdmin = group.members.some((member) => `${member.userId}` === `${req.currentUser!.userId}` && member.role === 'admin');
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

    // Remove member
    const updatedGroup = await groupChatService.removeGroupChatMember(groupId, memberId);

    // Remove group from member's chat list
    // TODO: When implementing in redis cache, add method to remove group from user's chat list

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
      senderId: 'system',
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

    // Check if group exists
    const group = await groupChatService.getGroupChatById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    // Check if current user is admin
    const isCurrentUserAdmin = group.members.some((member) => `${member.userId}` === `${req.currentUser!.userId}` && member.role === 'admin');

    if (!isCurrentUserAdmin) {
      throw new BadRequestError('Only admins can promote members');
    }

    // Check if member exists and is not already an admin
    const memberToPromote = group.members.find((member) => `${member.userId}` === `${memberId}`);
    if (!memberToPromote) {
      throw new BadRequestError('Member not found in group');
    }

    if (memberToPromote.role === 'admin') {
      throw new BadRequestError('Member is already an admin');
    }

    // Update member role to admin
    memberToPromote.role = 'admin';
    await groupChatService.updateGroupChat(groupId, { members: group.members });

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
      senderId: 'system',
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

    // Check if group exists
    const group = await groupChatService.getGroupChatById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    // Check if current user is admin
    const isCurrentUserAdmin = group.members.some((member) => `${member.userId}` === `${req.currentUser!.userId}` && member.role === 'admin');

    if (!isCurrentUserAdmin) {
      throw new BadRequestError('Only admins can delete the group');
    }

    // Delete group
    await groupChatService.deleteGroupChat(groupId);

    // TODO: When implementing redis cache, add method to remove group from all members' chat lists

    // Notify members
    socketIOChatObject.emit('group deleted', {
      groupId,
      members: group.members
    });

    res.status(HTTP_STATUS.OK).json({
      message: 'Group deleted successfully'
    });
  }
}
