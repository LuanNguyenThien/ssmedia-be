import mongoose, { model, Model, Schema } from 'mongoose';
import { IFavPostDocument } from '@favorite-posts/interfaces/fav-post.interface';


const favoritePostSchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', index: true },
  createdAt: { type: Date, default: Date.now }
});

const FavPostModel: Model<IFavPostDocument> = model<IFavPostDocument>('FavoritePost', favoritePostSchema, 'FavoritePost');

export { FavPostModel };