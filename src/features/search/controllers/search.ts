import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { userService } from '@service/db/user.service';
import { postService } from '@service/db/post.service';
import { Helpers } from '@global/helpers/helpers';
import { textServiceAI } from '@api-serverAI/text/text.AIservice';
import { ISearchResult } from '../interfaces/search.interface';

export class Search {
  public async combinedSearch(req: Request, res: Response): Promise<void> {
    const query = req.params.query;
    console.log('Query:', query);

    try {
      const userRegex = new RegExp(Helpers.escapeRegex(query), 'i');
      const vectorizedText = await textServiceAI.vectorizeText(query);
      const [users, posts] = await Promise.all([userService.searchUsers(userRegex), postService.searchPostsByVector(vectorizedText.vector)]);

      const result: ISearchResult = { users, posts };
      res.status(HTTP_STATUS.OK).json({ message: 'Search results', result });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error performing search', error });
    }
  }
}
