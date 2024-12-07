import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { config } from '@root/config';
import { ServerError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';
import { IFavPostDocument } from '@favorite-posts/interfaces/fav-post.interface';

const log: Logger = config.createLogger('favPostCache');

export class FavPostCache extends BaseCache {
  constructor() {
    super('favPostCache');
  }

  public async toggleFavoritePostInCache(userId: string, postId: string, value: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // Kiểm tra xem bài viết yêu thích đã tồn tại trong cache chưa
      const existingFavorite = await this.getFavoritePostFromCache(userId, postId);
      if (existingFavorite) {
        // Nếu đã tồn tại, xóa bài viết yêu thích khỏi cache
        await this.deleteFavoritePostFromCache(userId, postId);
      } else {
        // Nếu chưa tồn tại, thêm bài viết yêu thích vào cache
        await this.client.HSET(`favoritePosts:${userId}`, postId, value);
      }
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async deleteFavoritePostFromCache(userId: string, postId: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // Xóa bài viết yêu thích khỏi cache
      await this.client.HDEL(`favoritePosts:${userId}`, postId);
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getFavoritePostFromCache(userId: string, postId: string): Promise<IFavPostDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // Lấy bài viết yêu thích từ cache
      const favoritePost = await this.client.HGET(`favoritePosts:${userId}`, postId);
      if (!favoritePost) {
        return null;
      }

      return Helpers.parseJson(favoritePost) as IFavPostDocument;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getAllFavoritePostsFromCache(userId: string): Promise<IFavPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // Lấy tất cả bài viết yêu thích từ cache
      const favoritePosts = await this.client.HGETALL(`favoritePosts:${userId}`);
      const list: IFavPostDocument[] = [];
      for (const postId in favoritePosts) {
        list.push(Helpers.parseJson(favoritePosts[postId]) as IFavPostDocument);
      }

      return list;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }
}