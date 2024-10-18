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
        favPostQueue.addFavPostJob('addFavPostToDB', favPost);

        res.status(HTTP_STATUS.CREATED).json({ message: 'Post added to favorites successfully' });
    }
}