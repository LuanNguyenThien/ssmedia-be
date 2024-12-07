import { IFavPostDocument } from '@favorite-posts/interfaces/fav-post.interface';
import { BaseQueue } from '@service/queues/base.queue';
import { favPostWorker } from '@worker/favpost.worker';

class FavPostQueue extends BaseQueue {
  private static instance: FavPostQueue;
  constructor() {
    super('favPosts');
    this.processJob('addFavPostToDB', 5, favPostWorker.addFavPostToDB);
    this.processJob('removeFavPostFromDB', 5, favPostWorker.removeFavPostFromDB);
  }

  public static getInstance(): FavPostQueue {
    if (!FavPostQueue.instance) {
      FavPostQueue.instance = new FavPostQueue();
    }
    return FavPostQueue.instance;
  }

  public addFavPostJob(name: string, data: IFavPostDocument): void {
    this.addJob(name, data);
  }
}

export const favPostQueue: FavPostQueue = FavPostQueue.getInstance();