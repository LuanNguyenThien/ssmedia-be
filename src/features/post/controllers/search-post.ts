import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { IPostDocument } from '@post/interfaces/post.interface';
import { postService } from '@service/db/post.service';
import { cache } from '@service/redis/cache';
import { textServiceAI } from '@api-serverAI/text/text.AIservice';

const postCache = cache.postCache;
const PAGE_SIZE = 10;

export class Search {
  public async searchPosts(req: Request, res: Response): Promise<void> {
    const search = req.params.query;
    try {
      // Gửi truy vấn đến server Python để vector hóa
      const response = await textServiceAI.vectorizeText(search);
      const queryVector = response.vector;

      // Thực hiện tìm kiếm trong MongoDB sử dụng vector
      const posts: IPostDocument[] = await postService.searchPostsByVector(queryVector);
      console.log(posts);
      res.status(HTTP_STATUS.OK).json({ message: 'Posts found', posts });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error searching posts', error });
    }
  }
}
