import { MessageCache } from "./message.cache";
import { UserCache } from "./user.cache";
import { PostCache } from "./post.cache";
import { FollowerCache } from "./follower.cache";
import { CommentCache } from "./comment.cache";
import { ReactionCache } from "./reaction.cache";


class Cache {
    private static instance: Cache;
    public userCache: UserCache;
    public messageCache: MessageCache;
    public postCache: PostCache;
    public followerCache: FollowerCache;
    public commentCache: CommentCache;
    public reactionCache: ReactionCache;
  
    private constructor() {
      this.userCache = new UserCache();
      this.messageCache = new MessageCache();
      this.postCache = new PostCache();
      this.followerCache = new FollowerCache();
      this.commentCache = new CommentCache();
      this.reactionCache = new ReactionCache();
    }
  
    public static getInstance(): Cache {
      if (!Cache.instance) {
        console.log("1 2 3 hello")
        Cache.instance = new Cache();
      }
      return Cache.instance;
    }
  }

export const cache: Cache = Cache.getInstance();
  
