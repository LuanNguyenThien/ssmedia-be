import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import HTTP_STATUS from 'http-status-codes';
import mongoose from 'mongoose';
// import { FollowerCache } from '@service/redis/follower.cache';
import { IFollowerData } from '@follower/interfaces/follower.interface';
import { followerService } from '@service/db/follower.service';
import { cache } from '@service/redis/cache';

// const followerCache: FollowerCache = new FollowerCache();
const followerCache = cache.followerCache;
const SIZE = 6;

export class Get {
  public async userFollowing(req: Request, res: Response): Promise<void> {
    const userObjectId: ObjectId = new mongoose.Types.ObjectId(req.currentUser!.userId);
    // const cachedFollowees: IFollowerData[] = await followerCache.getFollowersFromCache(`following:${req.currentUser!.userId}`);
    // const following: IFollowerData[] = cachedFollowees.length ? cachedFollowees : await followerService.getFolloweeData(userObjectId);
    const following: IFollowerData[] = await followerService.getFolloweeData(userObjectId);

    res.status(HTTP_STATUS.OK).json({ message: 'User following', following });
  }

  public async userFollowingPaginated(req: Request, res: Response): Promise<void> {
    const { page } = req.params;
    const pageNumber = parseInt(page, 10);
    
    if (isNaN(pageNumber) || pageNumber < 1) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Invalid page number' });
      return;
    }
    
    const skip: number = (pageNumber - 1) * SIZE;
    console.time('userFollowingPaginated');
    const userObjectId: ObjectId = new mongoose.Types.ObjectId(req.currentUser!.userId);
    // const cachedFollowees: IFollowerData[] = (await followerCache.getFollowersFromCache(`following:${req.currentUser!.userId}`)).slice(
    //   skip,
    //   skip + SIZE
    // ) as IFollowerData[];

    // if (cachedFollowees.length) {
    //   console.log('cachedFollowees');
    //   res.status(HTTP_STATUS.OK).json({ message: 'User following', following: cachedFollowees });
    //   console.timeEnd('userFollowingPaginated');
    //   return;
    // } else {
    //   console.log('not cachedFollowees');
    //   const following: IFollowerData[] = await followerService.getFolloweeDataPaginated(userObjectId, skip, SIZE);
    //   console.timeEnd('userFollowingPaginated');
    //   res.status(HTTP_STATUS.OK).json({ message: 'User following', following });
    // }

    const following: IFollowerData[] = await followerService.getFolloweeDataPaginated(userObjectId, skip, SIZE);
    console.timeEnd('userFollowingPaginated');
    res.status(HTTP_STATUS.OK).json({ message: 'User following', following });
  }

  public async userFollowers(req: Request, res: Response): Promise<void> {
    const userObjectId: ObjectId = new mongoose.Types.ObjectId(req.params.userId);
    // const cachedFollowers: IFollowerData[] = await followerCache.getFollowersFromCache(`followers:${req.params.userId}`);
    // const followers: IFollowerData[] = cachedFollowers.length ? cachedFollowers : await followerService.getFollowerData(userObjectId);
    const followers: IFollowerData[] = await followerService.getFollowerData(userObjectId);
  
    res.status(HTTP_STATUS.OK).json({ message: 'User followers', followers });
  }

  public async userFollowersPaginated(req: Request, res: Response): Promise<void> {
    const { page } = req.params;
    const pageNumber = parseInt(page, 10);
    
    if (isNaN(pageNumber) || pageNumber < 1) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Invalid page number' });
      return;
    }
    
    const skip: number = (pageNumber - 1) * SIZE;
    const userObjectId: ObjectId = new mongoose.Types.ObjectId(req.params.userId);
    // const cachedFollowers: IFollowerData[] = await followerCache.getFollowersFromCache(`followers:${req.params.userId}`);
    // const followers: IFollowerData[] = cachedFollowers.length ? cachedFollowers : await followerService.getFollowerDataPaginated(userObjectId, skip, SIZE);
    const followers: IFollowerData[] = await followerService.getFollowerDataPaginated(userObjectId, skip, SIZE);
    res.status(HTTP_STATUS.OK).json({ message: 'User followers', followers });
  }
}
