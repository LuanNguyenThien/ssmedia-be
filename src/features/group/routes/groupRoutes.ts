import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { GroupController } from '@root/features/group/controllers/group';

class GroupRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    const group = new GroupController();
    //for testing purposes

    // User-specific invitation routes 
    this.router.get('/group/invitations', authMiddleware.checkAuthentication, group.getUserPendingGroupsforUser);
    this.router.get('/group/not-joined', authMiddleware.checkAuthentication, group.getGroupsUserNotJoined);
    this.router.get('/group/pending-admin/:groupId', authMiddleware.checkAuthentication, group.getPendingUsersInGroup);
    this.router.put('/group/invitation/accept/:groupId', authMiddleware.checkAuthentication, group.acceptGroupInvitation);
    this.router.put('/group/invitation/decline/:groupId', authMiddleware.checkAuthentication, group.rejectGroupInvitation);
    this.router.put('/group/approve-member/:groupId/:userId', authMiddleware.checkAuthentication, group.approveMemberByAdmin);
    this.router.put('/group/reject-member/:groupId/:userId', authMiddleware.checkAuthentication, group.rejectMemberByAdmin);
    this.router.put('/group/leave/:groupId', authMiddleware.checkAuthentication, group.leaveGroup);
    this.router.post('/group/join/:groupId', authMiddleware.checkAuthentication, group.requestToJoinGroup);
    
    // Group creation and management
    this.router.post('/group/create', authMiddleware.checkAuthentication, group.create);
    this.router.get('/group/user-group/:userId', authMiddleware.checkAuthentication, group.getUserGroups);
    this.router.get('/group/allgroups', authMiddleware.checkAuthentication, group.getRandomGroups);
    this.router.get('/group/:groupId/posts/:page', authMiddleware.checkAuthentication, group.getGroupPosts);
    this.router.get('/group/:groupId/postspending/:page', authMiddleware.checkAuthentication, group.getGroupPostsPending);
    this.router.get('/group/:groupId', authMiddleware.checkAuthentication, group.getGroup);
    this.router.put('/group/:groupId', authMiddleware.checkAuthentication, group.updateGroupInfo);
    this.router.put('/group/add-members/:groupId', authMiddleware.checkAuthentication, group.addMembers);
    this.router.put('/group/remove-members/:groupId', authMiddleware.checkAuthentication, group.removeMembers);
    this.router.delete('/group/:groupId', authMiddleware.checkAuthentication, group.deleteGroup);
    this.router.put('/group/post/:postId/accept', authMiddleware.checkAuthentication, group.acceptPost);
    this.router.put('/group/post/:postId/decline', authMiddleware.checkAuthentication, group.declinedPost);
    //Post routes
    return this.router;
  }
}

export const groupRoutes: GroupRoutes = new GroupRoutes();
