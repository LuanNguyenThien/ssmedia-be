import { IPostDocument } from '@post/interfaces/post.interface';
import { ISearchUser } from '@user/interfaces/user.interface';

export interface ISearchResult {
  users: ISearchUser[];
  posts: IPostDocument[];
}
