import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { IReactionJob } from '@reaction/interfaces/reaction.interface';
// import { ReactionCache } from '@service/redis/reaction.cache';
import { reactionQueue } from '@service/queues/reaction.queue';
import { cache } from '@service/redis/cache';

// const reactionCache: ReactionCache = new ReactionCache();
const reactionCache = cache.reactionCache;

export class Remove {
  public async reaction(req: Request, res: Response): Promise<void> {
    const { postId, previousReaction, postReactions } = req.params;
    await reactionCache.removePostReactionFromCache(postId, `${req.currentUser!.username}`, JSON.parse(postReactions));
    const databaseReactionData: IReactionJob = {
      postId,
      username: req.currentUser!.username,
      userFrom: req.currentUser!.userId,
      previousReaction
    };
    reactionQueue.addReactionJob('removeReactionFromDB', databaseReactionData);
    res.status(HTTP_STATUS.OK).json({ message: 'Reaction removed from post' });
  }
}
