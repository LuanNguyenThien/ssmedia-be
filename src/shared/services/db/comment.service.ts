import { ICommentDocument, ICommentJob, ICommentNameList, IQueryComment } from '@comment/interfaces/comment.interface';
import { CommentsModel } from '@comment/models/comment.schema';
import { IPostDocument } from '@post/interfaces/post.interface';
import { PostModel } from '@post/models/post.schema';
import mongoose, { Query } from 'mongoose';
// import { UserCache } from '@service/redis/user.cache';
import { IUserDocument } from '@user/interfaces/user.interface';
import { NotificationModel } from '@notification/models/notification.schema';
import { INotificationDocument, INotificationTemplate } from '@notification/interfaces/notification.interface';
import { socketIONotificationObject } from '@socket/notification';
import { notificationTemplate } from '@service/emails/templates/notifications/notification-template';
import { emailQueue } from '@service/queues/email.queue';
import { cache } from '@service/redis/cache';

// const userCache: UserCache = new UserCache();
const userCache = cache.userCache;

class CommentService {
  public async addCommentToDB(commentData: ICommentJob): Promise<void> {
    const { postId, userTo, userFrom, comment, username } = commentData;

    try {
      // Create the comment first
      const commentCreated: ICommentDocument = await CommentsModel.create(comment);

      // Update post with explicit findByIdAndUpdate instead of using a Query object
      const postUpdated: IPostDocument | null = await PostModel.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } }, { new: true });

      console.log(
        'Post update result:',
        postUpdated ? `Updated post ${postId}, new commentsCount: ${postUpdated.commentsCount}` : `Post ${postId} not found`
      );

      // Get user information
      const user: IUserDocument = (await userCache.getUserFromCache(userTo)) as IUserDocument;

      // Send notification if needed
      if (user && user.notifications && user.notifications.comments && userFrom !== userTo) {
        const notificationModel: INotificationDocument = new NotificationModel();
        const notifications = await notificationModel.insertNotification({
          userFrom,
          userTo,
          message: `${username} commented on your post.`,
          notificationType: 'comment',
          entityId: new mongoose.Types.ObjectId(postId),
          createdItemId: new mongoose.Types.ObjectId(commentCreated._id!),
          createdAt: new Date(),
          comment: comment.comment,
          post: postUpdated ? postUpdated.post : '',
          htmlPost: postUpdated ? postUpdated.htmlPost! : '',
          imgId: postUpdated ? postUpdated.imgId! : '',
          imgVersion: postUpdated ? postUpdated.imgVersion! : '',
          gifUrl: postUpdated ? postUpdated.gifUrl! : '',
          reaction: '',
          post_analysis: ''
        });
        socketIONotificationObject.emit('insert notification', notifications, { userTo });
        const templateParams: INotificationTemplate = {
          username: user.username!,
          message: `${username} commented on your post.`,
          header: 'Comment Notification'
        };
        const template: string = notificationTemplate.notificationMessageTemplate(templateParams);
        emailQueue.addEmailJob('commentsEmail', { receiverEmail: user.email!, template, subject: 'Post notification' });
      }
    } catch (error) {
      console.error('Error in addCommentToDB:', error);
      throw error;
    }
  }

  public async getPostComments(query: IQueryComment, sort: Record<string, 1 | -1>): Promise<ICommentDocument[]> {
    const comments: ICommentDocument[] = await CommentsModel.aggregate([{ $match: query }, { $sort: sort }]);
    return comments;
  }

  public async getPostCommentNames(query: IQueryComment, sort: Record<string, 1 | -1>): Promise<ICommentNameList[]> {
    const commentsNamesList: ICommentNameList[] = await CommentsModel.aggregate([
      { $match: query },
      { $sort: sort },
      { $group: { _id: null, names: { $addToSet: '$username' }, count: { $sum: 1 } } },
      { $project: { _id: 0 } }
    ]);
    return commentsNamesList;
  }
}

export const commentService: CommentService = new CommentService();
