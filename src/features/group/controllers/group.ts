import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { groupService } from '@service/db/group.service';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { BadRequestError } from '@global/helpers/error-handler';
import { createGroupSchema, updateGroupSchema, addMembersSchema } from '@root/features/group/schemes/group.schemes'; // Schema validation cho create group
import { cache } from '@service/redis/cache';
import { IGroupDocument, IGroupMember } from '@root/features/group/interfaces/group.interface';
import { ObjectId } from 'mongodb';
import { UploadApiResponse } from 'cloudinary';
import { uploads } from '@global/helpers/cloudinary-upload';
import { userService } from '@service/db/user.service';
import { postService } from '@service/db/post.service';
import { socketIOPostObject } from '@socket/post';
import { IPostDocument } from '@post/interfaces/post.interface';

import { PostModel } from '@post/models/post.schema';
const userCache = cache.userCache;
const postCache = cache.postCache;
export class GroupController {
  @joiValidation(createGroupSchema)
  public async create(req: Request, res: Response): Promise<void> {
    const { name, description, privacy, members, tags, category, profileImage } = req.body;

    const currentUser = await userCache.getUserFromCache(`${req.currentUser!.userId}`);
    if (!currentUser) {
      throw new BadRequestError('Invalid user');
    }

    console.log('Current User:', currentUser);
    const creatorId = new ObjectId(req.currentUser!.userId);
    const memberList: IGroupMember[] = [];

    // Thêm creator làm admin (bắt buộc)
    memberList.push({
      userId: creatorId,
      username: req.currentUser!.username,
      avatarColor: req.currentUser!.avatarColor || '#ffffff',
      profilePicture: currentUser.profilePicture || '',
      joinedAt: new Date(),
      role: 'admin',
      joinedBy: 'self',
      status: 'active'
    });

    // Thêm các member được gửi từ client (đã đầy đủ thông tin)
    for (const member of members || []) {
      // Bỏ qua creator nếu có trong members
      if (member.userId === req.currentUser!.userId) continue;

      memberList.push({
        userId: new ObjectId(member.userId),
        username: member.username,
        avatarColor: member.avatarColor || '#ffffff',
        profilePicture: member.profilePicture || '',
        joinedAt: member.joinedAt ? new Date(member.joinedAt) : new Date(),
        role: member.role || 'member',
        joinedBy: member.joinedBy || 'invited',
        status: 'pending_user',
        invitedBy: member.invitedBy ? new ObjectId(member.invitedBy) : undefined
      });
    }

    const group = await groupService.createGroup({
      name,
      description,
      privacy,
      profileImage,
      createdBy: creatorId,
      members: memberList,
      tags,
      category
    });

    res.status(HTTP_STATUS.CREATED).json({ message: 'Group created successfully', group });
  }

  public async getUserGroups(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    const groups = await groupService.getGroupsByUserId(userId);

    res.status(HTTP_STATUS.OK).json({
      message: 'Groups retrieved successfully',
      groups
    });
  }

  public async getGroup(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;

    // if (!Types.ObjectId.isValid(groupId)) {
    //   throw new BadRequestError('Invalid group ID');
    // }

    const group = await groupService.getGroupById(groupId);

    if (!group) {
      throw new BadRequestError('Group not found');
    }

    res.status(HTTP_STATUS.OK).json({
      message: 'Group info',
      group
    });
  }

  @joiValidation(updateGroupSchema)
  public async updateGroupInfo(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const { name, description, profileImage, privacy, tags, category } = req.body;

      // Lấy group từ DB
      const group = await groupService.getGroupById(groupId);
      if (!group) {
        throw new BadRequestError('Group not found');
      }

      // Kiểm tra quyền admin
      const currentUserId = req.currentUser?.userId;
      if (!currentUserId) {
        throw new BadRequestError('Unauthorized request');
      }

      const currentUserMember = group.members.find((member) => `${member.userId}` === `${currentUserId}`);

      if (!currentUserMember || currentUserMember.role !== 'admin') {
        throw new BadRequestError('Only admins can update group information');
      }

      // Xử lý upload ảnh nếu có
      let updatedProfileImage = group.profileImage || '';
      if (profileImage) {
        const result: UploadApiResponse = (await uploads(profileImage)) as UploadApiResponse;
        if (!result?.public_id) {
          throw new BadRequestError(result.message || 'Image upload failed');
        }
        updatedProfileImage = `https://res.cloudinary.com/di6ozapw8/image/upload/v${result.version}/${result.public_id}`;
      }

      // Chuẩn bị dữ liệu cập nhật
      const updateData: Partial<IGroupDocument> = {
        name: name ?? group.name,
        description: description ?? group.description,
        profileImage: updatedProfileImage,
        privacy: privacy ?? group.privacy,
        tags: tags ?? group.tags,
        category: category ?? group.category
      };

      // Cập nhật trong DB
      const updatedGroup = await groupService.updateGroup(groupId, updateData);

      // Gửi phản hồi
      res.status(HTTP_STATUS.OK).json({
        message: 'Group updated successfully',
        group: updatedGroup
      });
    } catch (error) {
      console.error('Error updating group info:', error);
      throw error;
    }
  }

  @joiValidation(addMembersSchema)
  public async addMembers(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const { members } = req.body as { members: string[] };

    // 1. Lấy nhóm từ DB
    const group = await groupService.getGroupById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    // BỎ phần check admin ở đây

    // 2. Lấy danh sách userId hiện tại trong nhóm để tránh thêm trùng
    const existingUserIds = new Set(group.members.map((m) => m.userId.toString()));

    // 3. Chuẩn bị danh sách member mới (lấy thông tin user từ DB)
    const newMembersList: IGroupMember[] = [];
    const currentUserId = req.currentUser!.userId;

    const currentUserMember = group.members.find((member) => `${member.userId}` === `${currentUserId}`);
    if (!currentUserMember) {
      throw new BadRequestError('Only group members can invite new members');
    }
    const currentUserInfo = await userService.getUserById(currentUserId);

    for (const memberId of members) {
      if (!existingUserIds.has(memberId)) {
        const user = await userService.getUserById(memberId);
        if (user) {
          newMembersList.push({
            userId: memberId,
            username: user.username,
            avatarColor: user.avatarColor,
            profilePicture: user.profilePicture || '',
            role: 'member',
            status: 'pending_user',
            joinedBy: 'invited',
            joinedAt: new Date(),
            invitedBy: req.currentUser?.username ? new ObjectId(currentUserId) : undefined,
            invitedInfo: {
              username: currentUserInfo.username,
              avatarColor: currentUserInfo.avatarColor,
              profilePicture: currentUserInfo.profilePicture,
              email: currentUserInfo.email
            }
          });
        }
      }
    }

    if (newMembersList.length === 0) {
      throw new BadRequestError('No new members to add');
    }

    // 4. Gọi service để thêm member mới vào nhóm
    const updatedGroup = await groupService.addMembersToGroup(groupId, newMembersList);

    // 5. Trả kết quả về client
    res.status(HTTP_STATUS.OK).json({
      message: 'Members added to group successfully',
      newMembers: newMembersList,
      group: updatedGroup
    });
  }

  public async removeMembers(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const { members } = req.body; // mảng userId cần xóa

    // Lấy group từ DB
    const group = await groupService.getGroupById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    // Kiểm tra user hiện tại có phải admin không
    const currentUserId = req.currentUser!.userId;
    const currentUserMember = group.members.find((m) => m.userId.toString() === currentUserId);
    if (!currentUserMember || currentUserMember.role !== 'admin') {
      throw new BadRequestError('Only admins can remove members');
    }

    // Lọc các member có trong nhóm để xóa
    const membersInGroup = group.members.map((m) => m.userId.toString());
    const membersToRemove = members.filter((memberId: string) => membersInGroup.includes(memberId));

    if (membersToRemove.length === 0) {
      throw new BadRequestError('No valid members to remove');
    }

    // Không cho xóa admin nếu chỉ còn 1 admin
    for (const memberId of membersToRemove) {
      const member = group.members.find((m) => m.userId.toString() === memberId);
      if (member?.role === 'admin') {
        throw new BadRequestError('Cannot remove admin members');
      }
    }

    // Gọi service để xóa member
    const updatedGroup = await groupService.removeMembersFromGroup(groupId, membersToRemove);

    // Trả về kết quả
    res.status(HTTP_STATUS.OK).json({
      message: 'Members removed successfully',
      group: updatedGroup
    });
  }

  public async deleteGroup(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;

    // Lấy nhóm từ DB
    const group = await groupService.getGroupById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    // Kiểm tra user hiện tại có phải admin không
    const currentUserId = req.currentUser!.userId;
    const currentUserMember = group.members.find((m) => m.userId.toString() === currentUserId);
    if (!currentUserMember || currentUserMember.role !== 'admin') {
      throw new BadRequestError('Only admins can delete the group');
    }

    // Gọi service xóa nhóm
    await groupService.deleteGroupById(groupId);

    // Gửi response thành công
    res.status(HTTP_STATUS.OK).json({
      message: 'Group deleted successfully'
    });
  }

  public async getUserPendingGroupsforUser(req: Request, res: Response): Promise<void> {
    const userId = req.currentUser!.userId;

    const pendingGroups: IGroupDocument[] = await groupService.getUserPendingGroups(userId);

    res.status(HTTP_STATUS.OK).json({
      message: 'Pending group invitations fetched successfully',
      groups: pendingGroups
    });
  }

  public async getPendingUsersInGroup(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const adminId = req.currentUser!.userId;

    // Lấy group
    const group = await groupService.getGroupById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    // Kiểm tra admin
    const isAdmin = group.members.some((member) => member.userId.toString() === adminId && member.role === 'admin');

    if (!isAdmin) {
      throw new BadRequestError('You do not have permission to view pending members');
    }

    // Lọc ra các member có state = 'pending_admin'
    const pendingMembers = group.members.filter((member) => member.status === 'pending_admin');

    res.status(HTTP_STATUS.OK).json({
      message: 'Pending members fetched successfully',
      pendingMembers
    });
  }

  public async acceptGroupInvitation(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const userId = req.currentUser!.userId;

    const group = await groupService.getGroupById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    const member = group.members.find((m) => m.userId.toString() === userId && m.status === 'pending_user');
    if (!member) {
      throw new BadRequestError('No pending invitation found for this user');
    }

    const inviter = group.members.find((m) => m.userId.toString() === member.invitedBy?.toString());

    if (!inviter) {
      throw new BadRequestError('Inviter not found');
    }

    // Nếu inviter là admin thì duyệt thẳng
    if (inviter.role === 'admin') {
      member.status = 'active';
    } else {
      member.status = 'pending_admin'; // chờ admin duyệt
    }

    await groupService.saveGroup(group);

    res.status(200).json({
      message: 'Invitation accepted successfully',
      memberState: member
    });
  }

  public async rejectGroupInvitation(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const userId = req.currentUser!.userId;

    // Lấy group từ DB
    const group = await groupService.getGroupById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    // Kiểm tra xem user có lời mời đang chờ không
    const isPending = group.members.some((member) => `${member.userId}` === `${userId}` && member.status === 'pending_user');

    if (!isPending) {
      throw new BadRequestError('No pending invitation found for this user');
    }

    // Gọi service để cập nhật trạng thái thành rejected
    await groupService.rejectGroupInvitation(groupId, userId);

    res.status(HTTP_STATUS.OK).json({
      message: 'Invitation rejected successfully'
    });
  }

  public async approveMemberByAdmin(req: Request, res: Response): Promise<void> {
    const { groupId, userId } = req.params;
    const currentUserId = req.currentUser!.userId;

    const group = await groupService.getGroupById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    const isAdmin = group.members.some((member) => `${member.userId}` === `${currentUserId}` && member.role === 'admin');

    if (!isAdmin) {
      throw new BadRequestError('You do not have permission to approve members');
    }

    const member = group.members.find((member) => `${member.userId}` === `${userId}` && member.status === 'pending_admin');

    if (!member) {
      throw new BadRequestError('Member is not awaiting admin approval');
    }

    await groupService.approveMemberByAdmin(groupId, userId);

    res.status(HTTP_STATUS.OK).json({
      message: 'Member approved successfully'
    });
  }

  public async rejectMemberByAdmin(req: Request, res: Response): Promise<void> {
    const { groupId, userId } = req.params;

    // Lấy group để kiểm tra quyền
    const group = await groupService.getGroupById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    const currentUserId = req.currentUser!.userId;

    const isAdmin = group.members.some((member) => `${member.userId}` === currentUserId && member.role === 'admin');

    if (!isAdmin) {
      throw new BadRequestError('Only admin can reject group invitations');
    }

    // Kiểm tra xem user đó có trong group không và đang ở trạng thái pending_admin
    const targetMember = group.members.find((member) => `${member.userId}` === userId && member.status === 'pending_admin');

    if (!targetMember) {
      throw new BadRequestError('User is not in pending_admin state');
    }

    // Cập nhật trạng thái sang rejected
    await groupService.rejectMemberByAdmin(groupId, userId);

    res.status(HTTP_STATUS.OK).json({
      message: 'Member invitation rejected by admin'
    });
  }

  public async leaveGroup(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const userId = req.currentUser!.userId;

    const group = await groupService.getGroupById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    const member = group.members.find((m) => m.userId.toString() === userId);
    if (!member) {
      throw new BadRequestError('You are not a member of this group');
    }

    // Nếu là admin duy nhất thì không cho rời nhóm
    if (member.role === 'admin') {
      throw new BadRequestError('Admin cannot leave the group');
    }

    await groupService.LeaveGroup(groupId, [userId]);

    // Có thể thêm message system thông báo người dùng rời nhóm nếu cần

    res.status(200).json({ message: 'You have left the group' });
  }

  public async requestToJoinGroup(req: Request, res: Response): Promise<void> {
    const { groupId } = req.params;
    const userId = req.currentUser!.userId;

    const group = await groupService.getGroupById(groupId);
    if (!group) {
      throw new BadRequestError('Group not found');
    }

    const alreadyInGroup = group.members.some((m) => m.userId.toString() === userId);
    const isRejected = group.members.some((m) => m.userId.toString() === userId && m.status === 'rejected');
    if (alreadyInGroup) {
      if (isRejected) {
        // throw new BadRequestError('You are not allowed to join this group');
        // const user = await userService.getUserById(userId);
        // if (!user) {
        //   // Thêm kiểm tra nếu không tìm thấy user
        //   throw new BadRequestError('User not found');
        // }

        // const member: IGroupMember = {
        //   userId: new ObjectId(userId),
        //   username: user.username,
        //   avatarColor: user.avatarColor || '#ffffff',
        //   profilePicture: user.profilePicture || '',
        //   role: 'member',
        //   status: 'pending_admin',
        //   joinedAt: new Date(),
        //   joinedBy: 'self'
        // };

        await groupService.joinGroupAgain(groupId, userId);

        res.status(HTTP_STATUS.OK).json({
          message: 'Request to join group sent successfully'
        });
        return;
      }
      throw new BadRequestError('You are already a member of this group');
    }

    const user = await userService.getUserById(userId);
    if (!user) {
      // Thêm kiểm tra nếu không tìm thấy user
      throw new BadRequestError('User not found');
    }

    const member: IGroupMember = {
      userId: new ObjectId(userId),
      username: user.username,
      avatarColor: user.avatarColor || '#ffffff',
      profilePicture: user.profilePicture || '',
      role: 'member',
      status: 'pending_admin',
      joinedAt: new Date(),
      joinedBy: 'self'
    };

    await groupService.addMember(groupId, member);

    res.status(HTTP_STATUS.OK).json({
      message: 'Request to join group sent successfully'
    });
  }

  public async getGroupsUserNotJoined(req: Request, res: Response): Promise<void> {
    const userId = req.currentUser!.userId;

    const groups = await groupService.getGroupsUserNotJoined(userId);

    res.status(200).json({
      message: 'Groups not joined by user',
      groups
    });
  }

  public async getGroupPosts(req: Request, res: Response): Promise<void> {
    try {
      const PAGE_SIZE = 10; // Số lượng bài viết mỗi trang
      const { groupId } = req.params;
      const page = parseInt(req.params.page || '1');
      const userId = req.currentUser!.userId;
      const limit = PAGE_SIZE;
      const skip = (page - 1) * limit;

      const group = await groupService.getGroupById(groupId);
      if (!group) {
        throw new BadRequestError('Group not found');
      }

      if (group.privacy === 'private') {
        const isMember = group.members.some((m) => m.userId.toString() === userId && m.status === 'active');
        if (!isMember) {
          throw new BadRequestError('Access denied to this private group');
        }
      }

      const { posts, totalPosts } = await postService.getPostsAcceptByGroup(groupId, page, limit);

      res.status(HTTP_STATUS.OK).json({
        message: 'Group posts fetched successfully',
        posts,
        totalPosts
      });
    } catch (error) {
      console.error('Error fetching group posts:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: 'Error fetching group posts',
        error: (error as Error).message
      });
    }
  }

  public async getGroupPostsPending(req: Request, res: Response): Promise<void> {
    try {
      const PAGE_SIZE = 10; // Số lượng bài viết mỗi trang
      const { groupId } = req.params;
      const page = parseInt(req.params.page || '1');
      const userId = req.currentUser!.userId;
      const limit = PAGE_SIZE;
      const skip = (page - 1) * limit;

      const group = await groupService.getGroupById(groupId);
      if (!group) {
        throw new BadRequestError('Group not found');
      }

      if (group.privacy === 'private') {
        const isMember = group.members.some((m) => m.userId.toString() === userId && m.status === 'active');
        if (!isMember) {
          throw new BadRequestError('Access denied to this private group');
        }
      }

      const { posts, totalPosts } = await postService.getPostsPendingByGroup(groupId, page, limit);

      res.status(HTTP_STATUS.OK).json({
        message: 'Group posts fetched successfully',
        posts,
        totalPosts
      });
    } catch (error) {
      console.error('Error fetching group posts:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: 'Error fetching group posts',
        error: (error as Error).message
      });
    }
  }

  public async acceptPost(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const updatedPost: Partial<IPostDocument> = {
        status: 'accepted'
      };

      // Update cache with type assertion
      await postCache.updatePostInCache(postId, updatedPost as IPostDocument);
      const postUpdated = await postService.acceptPost(postId);
      console.log('Post accepted:', postUpdated);

      if (!postUpdated) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Post not found' });
        return;
      }

      socketIOPostObject.emit('accept post', { postId });
      res.status(HTTP_STATUS.OK).json({ message: 'Post accepted successfully' });
    } catch (error) {
      console.error('Error accepting post:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error accepting post' });
    }
  }

  public async declinedPost(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;

      const updatedPost: Partial<IPostDocument> = {
        status: 'declined'
      };

      // Update cache with type assertion
      await postCache.updatePostInCache(postId, updatedPost as IPostDocument);
      const postUpdated = await postService.declinePost(postId);
      console.log('Post accepted:', postUpdated);

      if (!postUpdated) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Post not found' });
        return;
      }

      socketIOPostObject.emit('accept post', { postId });
      res.status(HTTP_STATUS.OK).json({ message: 'Post accepted successfully' });
    } catch (error) {
      console.error('Error accepting post:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error accepting post' });
    }
  }


  public async getRandomGroups(req: Request, res: Response): Promise<void> {
    const limit = parseInt(req.query.limit as string) || 10; // Default to 10 groups if no limit is provided
    const groups = await groupService.getRandomGroups(limit);
    const total = groups.length;
    res.status(HTTP_STATUS.OK).json({
      message: 'Random groups retrieved successfully',
      groups,
      total
    });
  }
}
