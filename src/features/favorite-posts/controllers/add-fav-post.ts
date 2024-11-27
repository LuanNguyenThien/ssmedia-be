import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import HTTP_STATUS from 'http-status-codes';
import { favPostsSchema } from '@favorite-posts/schemes/fav-posts';
import { IPostDocument } from '@post/interfaces/post.interface';
import { BadRequestError } from '@global/helpers/error-handler';
import { favPostQueue } from '@service/queues/favpost.queue';
import { cache } from '@service/redis/cache';
import { IFavPostDocument } from '@favorite-posts/interfaces/fav-post.interface';
import { PostModel } from '@post/models/post.schema';

const postCache = cache.postCache;

export class Add {
    @joiValidation(favPostsSchema)
    public async favoritePost(req: Request, res: Response): Promise<void> {
        const { postId } = req.body;
        const userId = req.currentUser!.userId;
        const favPostObjectId: ObjectId = new ObjectId();

        const favPost: IFavPostDocument = {
            _id: favPostObjectId,
            userId,
            postId,
            createdAt: new Date()
        } as IFavPostDocument;

        await postCache.toggleFavoritePostInCache(userId, postId);
        await postCache.toggleSavedByForPost(postId, userId);
        favPostQueue.addFavPostJob('addFavPostToDB', favPost);

        const post: IPostDocument = await PostModel.findById(postId) as IPostDocument;
        if (post?.favoritedBy?.includes(userId) ?? false) {
          // Nếu đã tồn tại, xóa userId khỏi mảng favoritedBy
          await PostModel.updateOne(
            { _id: postId },
            { $pull: { favoritedBy: userId } }
          );
        } else {
          // Nếu chưa tồn tại, thêm userId vào mảng favoritedBy
          await PostModel.updateOne(
            { _id: postId },
            { $addToSet: { favoritedBy: userId } }
          );
        }

        res.status(HTTP_STATUS.CREATED).json({ message: 'Post added to favorites successfully' });
    }
}