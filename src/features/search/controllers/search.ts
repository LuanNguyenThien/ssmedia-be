import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { userService } from '@service/db/user.service';
import { postService } from '@service/db/post.service';
import { Helpers } from '@global/helpers/helpers';
import { textServiceAI } from '@api-serverAI/text/text.AIservice';
import { ISearchResult } from '../interfaces/search.interface';
import { cache } from '@service/redis/cache';
import { ObjectId } from 'mongodb';

const userCache = cache.userCache;
const postCache = cache.postCache;
const userBehaviorCache = cache.userBehaviorCache;

export class Search {
  public async combinedSearch(req: Request, res: Response): Promise<void> {
    // const query = req.params.query;
    // console.log('Query:', query);

    // try {
    //   const userRegex = new RegExp(Helpers.escapeRegex(query), 'i');
    //   const vectorizedText = await textServiceAI.vectorizeText(query);
    //   const [users, posts] = await Promise.all([userService.searchUsers(userRegex), postService.searchPostsByVector(vectorizedText.vector)]);

    //   const result: ISearchResult = { users, posts };
    //   res.status(HTTP_STATUS.OK).json({ message: 'Search results', result });
    // } catch (error) {
    //   res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error performing search', error });
    // }
    const { query, image } = req.body;

    try {
      const userRegex = new RegExp(Helpers.escapeRegex(query), 'i');
      const vectorizedText = await textServiceAI.vectorizeText({ query, image });
      const [users, posts] = await Promise.all([userService.searchUsers(userRegex), postService.searchPostsByVector(vectorizedText.vector)]);

      const currentUser = await userCache.getUserFromCache(`${req.currentUser!.userId}`);
      if(currentUser?.personalizeSettings?.allowPersonalize !== false) {
        console.log('User interests:', vectorizedText.related_topics);
        if(vectorizedText.related_topics) {
          await postCache.clearPersonalizedPostsCache(req.currentUser!.userId as string);
          const objectId = new ObjectId() as unknown as string;
          // Save user interests from the post analysis
          await userBehaviorCache.saveUserInterests(req.currentUser!.userId as string, objectId, vectorizedText.related_topics);
        }
      }

      const result: ISearchResult = { users, posts };
      res.status(HTTP_STATUS.OK).json({ message: 'Search results', result });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error performing search', error });
    }
  }
}
