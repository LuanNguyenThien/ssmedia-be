import { ObjectId } from "mongodb";
import { IGetPostsQuery, IPostDocument } from "@post/interfaces/post.interface";
import { FavPostModel } from "@favorite-posts/models/fav-post.schema";
import { IFavPostDocument } from '@favorite-posts/interfaces/fav-post.interface';
import { PostModel } from "@post/models/post.schema";
import { postService } from "./post.service";

class FavPostService {
  // Thêm bài viết vào danh sách yêu thích
  public async addFavPost(favoritePostData: IFavPostDocument): Promise<IFavPostDocument> {
    const { userId, postId } = favoritePostData;

    // Kiểm tra xem bài viết đã có trong danh sách yêu thích chưa
    const existingFavorite = await FavPostModel.findOne({ userId, postId });

    if (existingFavorite) {
      // Nếu đã có, gọi phương thức bỏ yêu thích
      await this.removeFavPost(userId, postId);
      return existingFavorite; // Trả về bài viết đã bỏ yêu thích
    }

    // Nếu chưa có, tạo mới bài viết yêu thích
    return await FavPostModel.create(favoritePostData);
  }

  // Bỏ bài viết khỏi danh sách yêu thích
  public async removeFavPost(userId: string, postId: string): Promise<void> {
    await FavPostModel.deleteOne({ userId, postId });
  }

  // Lấy tất cả bài viết yêu thích của người dùng
  public async getFavoritePosts(userId: string, skip: number, limit: number): Promise<IPostDocument[]> {
    // Lấy danh sách các bài post yêu thích từ bảng FavPostModel
    const favoritePosts: IFavPostDocument[] = await FavPostModel.find({ userId }).exec();
    const postIds: string[] = favoritePosts.map(favPost => favPost.postId);
    // Sử dụng hàm getPosts để lấy thông tin chi tiết của các bài post
    const posts: IPostDocument[] = await postService.getPosts({ _id: { $in: postIds } }, skip, limit, {createAt: -1});
    return posts;
  }
}

export const favPostService: FavPostService = new FavPostService();