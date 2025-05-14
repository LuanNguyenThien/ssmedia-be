import { Helpers } from '@global/helpers/helpers';
import { IPostDocument } from '@post/interfaces/post.interface';
import { PostModel } from '@post/models/post.schema';
import { IQueryReaction, IReactionDocument, IReactionJob } from '@reaction/interfaces/reaction.interface';
import { ReactionModel } from '@reaction/models/reaction.schema';
// import { UserCache } from '@service/redis/user.cache';
import { IUserDocument } from '@user/interfaces/user.interface';
import { omit } from 'lodash';
import mongoose from 'mongoose';
import { INotificationDocument, INotificationTemplate } from '@notification/interfaces/notification.interface';
import { NotificationModel } from '@notification/models/notification.schema';
import { socketIONotificationObject } from '@socket/notification';
import { notificationTemplate } from '@service/emails/templates/notifications/notification-template';
import { emailQueue } from '@service/queues/email.queue';
import { cache } from '@service/redis/cache';

// const userCache: UserCache = new UserCache();
const userCache = cache.userCache;
const userBehaviorCache = cache.userBehaviorCache;
const postCache = cache.postCache;

class ReactionService {
  public async addReactionDataToDB(reactionData: IReactionJob): Promise<void> {
    // Destructure input data
    const { postId, userTo, userFrom, username, type, previousReaction, reactionObject } = reactionData;
    let updatedReactionObject: IReactionDocument = reactionObject as IReactionDocument;
    if (previousReaction) {
      updatedReactionObject = omit(reactionObject, ['_id']);
    }

    try {
      // Parallelize user cache fetch, reaction upsert, and post update
      const [userDoc, , postDoc] = (await Promise.all([
        userCache.getUserFromCache(`${userTo}`), // Consider using .lean() if possible in your cache implementation
        ReactionModel.replaceOne({ postId, type: previousReaction, username }, updatedReactionObject, { upsert: true }),
        PostModel.findOneAndUpdate(
          { _id: postId },
          {
            $inc: {
              [`reactions.${previousReaction}`]: -1,
              [`reactions.${type}`]: 1
            }
          },
          { new: true }
        ).lean() // Use lean for performance
      ])) as unknown as [IUserDocument, IReactionDocument, IPostDocument];

      if(type === 'upvote' && postDoc) {
        await postCache.clearPersonalizedPostsCache(userFrom as string);
        // Save user interests from the post analysis
        await userBehaviorCache.saveUserInterests(userFrom as string, postId, postDoc);
      }
      // Early exit if notification is not needed
      if (!userDoc?.notifications?.reactions || userTo === userFrom) return;

      // Prepare notification data
      const notificationPayload = {
        userFrom: userFrom as string,
        userTo: userTo as string,
        message: `${username} voted to your post.`,
        notificationType: 'reactions',
        entityId: new mongoose.Types.ObjectId(postId),
        createdItemId: new mongoose.Types.ObjectId((reactionObject as any)._id || ''),
        createdAt: new Date(),
        comment: '',
        post: postDoc?.post,
        htmlPost: postDoc?.htmlPost,
        imgId: postDoc?.imgId || '',
        imgVersion: postDoc?.imgVersion || '',
        gifUrl: postDoc?.gifUrl || '',
        reaction: type!,
        post_analysis: ''
      };

      // Parallelize notification insert, socket emit, and email queue
      await Promise.all([
        (async () => {
          try {
            const notificationModel: INotificationDocument = new NotificationModel();
            const notifications = await notificationModel.insertNotification(notificationPayload);
            socketIONotificationObject.emit('insert notification', notifications, { userTo });
          } catch (err) {
            // Log but do not throw to avoid blocking main flow
            console.error('Notification/socket error:', err);
          }
        })(),
        (async () => {
          try {
            const templateParams: INotificationTemplate = {
              username: userDoc.username!,
              message: `${username} voted to your post.`,
              header: 'Post Reaction Notification'
            };
            const template: string = notificationTemplate.notificationMessageTemplate(templateParams);
            await emailQueue.addEmailJob('reactionsEmail', {
              receiverEmail: userDoc.email!,
              template,
              subject: 'Post reaction notification'
            });
          } catch (err) {
            // Log but do not throw to avoid blocking main flow
            console.error('Email queue error:', err);
          }
        })()
      ]);
    } catch (err) {
      // Global error handler for DB/cache issues
      console.error('addReactionDataToDB error:', err);
      throw err;
    }
  }

  public async removeReactionDataFromDB(reactionData: IReactionJob): Promise<void> {
    const { postId, previousReaction, username } = reactionData;
    await Promise.all([
      ReactionModel.deleteOne({ postId, type: previousReaction, username }),
      PostModel.updateOne(
        { _id: postId },
        {
          $inc: {
            [`reactions.${previousReaction}`]: -1
          }
        },
        { new: true }
      )
    ]);
  }

  public async getPostReactions(query: IQueryReaction, sort: Record<string, 1 | -1>): Promise<[IReactionDocument[], number]> {
    const reactions: IReactionDocument[] = await ReactionModel.aggregate([{ $match: query }, { $sort: sort }]);
    return [reactions, reactions.length];
  }

  public async getSinglePostReactionByUsername(postId: string, username: string): Promise<[IReactionDocument, number] | []> {
    const reactions: IReactionDocument[] = await ReactionModel.aggregate([
      { $match: { postId: new mongoose.Types.ObjectId(postId), username: Helpers.firstLetterUppercase(username) } }
    ]);
    return reactions.length ? [reactions[0], 1] : [];
  }

  public async getReactionsByUsername(username: string): Promise<IReactionDocument[]> {
    const reactions: IReactionDocument[] = await ReactionModel.aggregate([
      { $match: { username: Helpers.firstLetterUppercase(username) } }
    ]);
    return reactions;
  }
}

export const reactionService: ReactionService = new ReactionService();
