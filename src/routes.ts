import { Application } from 'express';
import { authRoutes } from '@auth/routes/authRoutes';
import { serverAdapter } from '@service/queues/base.queue';
import { currentUserRoutes } from '@auth/routes/currentRoutes';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { postRoutes } from '@post/routes/postRoutes';
import { favpostRoutes } from '@favorite-posts/routes/fav-postRoutes';
import { reactionRoutes } from '@reaction/routes/reactionRoutes';
import { commentRoutes } from '@comment/routes/commentRoutes';
import { followerRoutes } from '@follower/routes/followerRoutes';
import { notificationRoutes } from '@notification/routes/notificationRoutes';
import { imageRoutes } from '@image/routes/imageRoutes';
import { chatRoutes } from '@chat/routes/chatRoutes';
import { groupChatRoutes } from '@root/features/group-chat/routes/groupchatRoutes';
import { userRoutes } from '@user/routes/userRoutes';
import { usersRoutes } from '@users/routes/usersRoutes';
import { postsRoutes } from '@posts/routes/postsRoutes';
import { statisticRoutes } from '@statistics/routes/statisticRoutes';
import { healthRoutes } from '@user/routes/healthRoutes';
import { searchRoutes } from '@search/routes/searchRoutes';
import { reportpostRoutes } from '@report-posts/routes/report-postRoutes';
import { reportprofileRoutes } from '@report-profiles/routes/report-profileRoutes';

const BASE_PATH = '/api/v1';
const BASE_PATH_ADMIN = '/api/v1/admin';

export default (app: Application) => {
  const routes = () => {
    app.use('/queues', serverAdapter.getRouter());
    app.use('', healthRoutes.health());
    app.use('', healthRoutes.env());
    app.use('', healthRoutes.instance());
    app.use('', healthRoutes.fiboRoutes());

    app.use(BASE_PATH, authRoutes.routes());
    app.use(BASE_PATH, authRoutes.signoutRoute());
    app.use(BASE_PATH_ADMIN, authMiddleware.verifyAdmin, usersRoutes.routes());
    app.use(BASE_PATH_ADMIN, authMiddleware.verifyAdmin, postsRoutes.routes());
    app.use(BASE_PATH_ADMIN, authMiddleware.verifyAdmin, statisticRoutes.routes());

    app.use(BASE_PATH, authMiddleware.verifyUser, currentUserRoutes.routes());
    app.use(BASE_PATH, authMiddleware.verifyUser, postRoutes.routes());
    app.use(BASE_PATH, authMiddleware.verifyUser, favpostRoutes.routes());
    app.use(BASE_PATH, authMiddleware.verifyUser, reportpostRoutes.routes());
    app.use(BASE_PATH, authMiddleware.verifyUser, reportprofileRoutes.routes());
    app.use(BASE_PATH, authMiddleware.verifyUser, reactionRoutes.routes());
    app.use(BASE_PATH, authMiddleware.verifyUser, commentRoutes.routes());
    app.use(BASE_PATH, authMiddleware.verifyUser, followerRoutes.routes());
    app.use(BASE_PATH, authMiddleware.verifyUser, notificationRoutes.routes());
    app.use(BASE_PATH, authMiddleware.verifyUser, imageRoutes.routes());
    app.use(BASE_PATH, authMiddleware.verifyUser, chatRoutes.routes());
    app.use(BASE_PATH, authMiddleware.verifyUser, groupChatRoutes.routes());
    app.use(BASE_PATH, authMiddleware.verifyUser, userRoutes.routes());
    app.use(BASE_PATH, authMiddleware.verifyUser, searchRoutes.routes());
  };
  routes();
};
