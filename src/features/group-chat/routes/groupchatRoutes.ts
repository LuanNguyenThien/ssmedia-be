import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { GroupChat } from '@root/features/group-chat/controllers/group-chat';

class GroupChatRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    const groupChat = new GroupChat();
    //for testing purposes
    this.router.get('/group-chat/get-all-group', authMiddleware.checkAuthentication, groupChat.getAllGroupChats);

    // User-specific invitation routes - these must come before other routes with similar patterns
    this.router.get('/group-chat/invitations', authMiddleware.checkAuthentication, groupChat.getUserPendingInvitations);
    this.router.put('/group-chat/invitation/accept/:groupId', authMiddleware.checkAuthentication, groupChat.acceptGroupInvitation);
    this.router.put('/group-chat/invitation/decline/:groupId', authMiddleware.checkAuthentication, groupChat.declineGroupInvitation);
    this.router.put('/group-chat/leave/:groupId', authMiddleware.checkAuthentication, groupChat.leaveGroup);
    this.router.get('/group-chat/check-member/:groupId/:userId', authMiddleware.checkAuthentication, groupChat.checkUserInGroup);
    // Group creation and management
    this.router.post('/group-chat/create', authMiddleware.checkAuthentication, groupChat.create);
    this.router.get('/group-chat/user-group/:userId', authMiddleware.checkAuthentication, groupChat.getUserGroups);
    this.router.get('/group-chat/:groupId', authMiddleware.checkAuthentication, groupChat.getGroupChat);
    this.router.put('/group-chat/:groupId', authMiddleware.checkAuthentication, groupChat.updateGroupInfo);
    this.router.put('/group-chat/add-members/:groupId', authMiddleware.checkAuthentication, groupChat.addMembers);
    this.router.put('/group-chat/promote/:groupId/:memberId', authMiddleware.checkAuthentication, groupChat.promoteToAdmin);
    this.router.delete('/group-chat/remove-members/:groupId/:memberId', authMiddleware.checkAuthentication, groupChat.removeMember);
    this.router.delete('/group-chat/:groupId', authMiddleware.checkAuthentication, groupChat.deleteGroup);

    return this.router;
  }
}

export const groupChatRoutes: GroupChatRoutes = new GroupChatRoutes();
