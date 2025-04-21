import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { GroupChat } from '@chat/controllers/group-chat';

class GroupChatRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    const groupChat = new GroupChat();

    this.router.post('/group-chat/create', authMiddleware.checkAuthentication, groupChat.create);
    this.router.get('/group-chat/:groupId', authMiddleware.checkAuthentication, groupChat.getGroupChat);
    // this.router.post('/group/message', authMiddleware.checkAuthentication, groupChat.groupMessage);
    // this.router.put('/group/add-members', authMiddleware.checkAuthentication, groupChat.addMembers);
    // this.router.put('/group/remove-members', authMiddleware.checkAuthentication, groupChat.removeMembers);
    // this.router.get('/groups', authMiddleware.checkAuthentication, groupChat.getUserGroups);

    return this.router;
  }
}

export const groupChatRoutes: GroupChatRoutes = new GroupChatRoutes();