import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { Helpers } from '@global/helpers/helpers';
import { userService } from '@service/db/user.service';
import { ISearchUser } from '@user/interfaces/user.interface';
import { cache } from '@service/redis/cache';

const userCache = cache.userCache;

export class Search {
  public async user(req: Request, res: Response): Promise<void> {
    // const query = req.params.query;
    const regex = new RegExp(Helpers.escapeRegex(req.params.query), 'i');
    let users: ISearchUser[];
    users = await userService.searchUsers(regex);

    // await userCache.searchUsersInCache(query);
    // if (users.length === 0) {
    // }
    res.status(HTTP_STATUS.OK).json({ message: 'Search results', search: users });
  }
}
