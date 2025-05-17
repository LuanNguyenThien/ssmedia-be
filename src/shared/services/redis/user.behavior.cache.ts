import { BaseCache } from '@service/redis/base.cache';
import { IPostDocument } from '@post/interfaces/post.interface';
import { ServerError } from '@global/helpers/error-handler';
import Logger from 'bunyan';
import { config } from '@root/config';

const log: Logger = config.createLogger('userBehaviorCache');
const CACHE_EXPIRATION_TIME = 1800; // 30 minutes in seconds

export class UserBehaviorCache extends BaseCache {
  constructor() {
    super('userBehaviorCache');
  }

  /**
   * Store user interest topics from an upvoted post
   */
  public async saveUserInterests(userId: string, postId: string, post: IPostDocument): Promise<void> {
    try {
      if (!post.analysis) {
        return;
      }

      const { mainTopics = [], contentTags = [], relatedTopics = [] } = post.analysis;
      
      // Skip if there are no topics to cache
      if (!mainTopics.length && !contentTags.length && !relatedTopics.length) {
        return;
      }

      const allTopics = [...mainTopics, ...contentTags, ...relatedTopics];
      const key = `userbehavior:${userId}:interests`;
      const entryKey = `post:${postId}`;
      
      // Get current entries
      const currentEntries = await this.client.HGETALL(key);
      const entriesCount = Object.keys(currentEntries).length;
      
      // If we have 20+ entries, remove oldest
      if (entriesCount >= 20) {
        const oldestKey = Object.keys(currentEntries)
          .sort((a, b) => JSON.parse(currentEntries[a]).timestamp - JSON.parse(currentEntries[b]).timestamp)[0];
        
        if (oldestKey) {
          await this.client.HDEL(key, oldestKey);
        }
      }
      
      // Store new entry
      await this.client.HSET(
        key,
        entryKey,
        JSON.stringify({
          topics: allTopics,
          timestamp: Date.now()
        })
      );
      
      // Set TTL for the entire hash if not already set
      const ttl = await this.client.TTL(key);
      if (ttl === -1) {
        await this.client.EXPIRE(key, CACHE_EXPIRATION_TIME);
      }
      
    } catch (error) {
      log.error(error);
      throw new ServerError('Error saving user interests to cache');
    }
  }

  /**
   * Remove user interest topics when downvoting a post
   */
  public async removeUserInterests(userId: string, postId: string): Promise<void> {
    try {
      const key = `user:${userId}:interests`;
      const entryKey = `post:${postId}`;
      await this.client.HDEL(key, entryKey);
    } catch (error) {
      log.error(error);
      throw new ServerError('Error removing user interests from cache');
    }
  }

  /**
   * Get user interests
   */
  public async getUserInterests(userId: string): Promise<string[]> {
    try {
      const key = `userbehavior:${userId}:interests`;
      const entries = await this.client.HGETALL(key);
      
      // Collect all topics from all entries
      const allTopics = new Set<string>();
      Object.values(entries).forEach(entry => {
        const parsed = JSON.parse(entry);
        parsed.topics.forEach((topic: string) => allTopics.add(topic));
      });
      
      return Array.from(allTopics);
    } catch (error) {
      log.error(error);
      throw new ServerError('Error getting user interests from cache');
    }
  }
}