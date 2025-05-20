import { hash, compare } from 'bcryptjs';
import { IAuthDocument } from '@auth/interfaces/auth.interface';
import { model, Model, Schema } from 'mongoose';

const SALT_ROUND = 10;

const authSchema: Schema = new Schema(
  {
    username: { type: String },
    uId: { type: String },
    email: { type: String },
    password: { type: String },
    avatarColor: { type: String },
    role: {
      type: String,
      enum: ['USER', 'ADMIN'],
      default: 'USER'
    },
    createdAt: { type: Date, default: Date.now },
    passwordResetToken: { type: String, default: '' },
    passwordResetExpires: { type: Number },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    bannedAt: { type: Date, default: null },
    provider: { type: String, default: 'local', enum: ['local', 'google'] },
    providerId: { type: String, default: null }
  },
  {
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        return ret;
      }
    }
  }
);

authSchema.pre('save', async function (this: IAuthDocument, next: () => void) {
  if (this.password) {
    const hashedPassword: string = await hash(this.password as string, SALT_ROUND);
    this.password = hashedPassword;
  }
  next();
});

authSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  const hashedPassword: string = (this as unknown as IAuthDocument).password!;
  return compare(password, hashedPassword);
};

authSchema.methods.hashPassword = async function (password: string): Promise<string> {
  return hash(password, SALT_ROUND);
};

const AuthModel: Model<IAuthDocument> = model<IAuthDocument>('Auth', authSchema, 'Auth');
export { AuthModel };
