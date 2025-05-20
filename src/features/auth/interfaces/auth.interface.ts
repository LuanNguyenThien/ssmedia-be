import { Document } from 'mongoose';
import { ObjectId } from 'mongodb';
import { IUserDocument } from '@user/interfaces/user.interface';

declare global {
  namespace Express {
    interface Request {
      currentUser?: AuthPayload;
    }
  }
}

export interface AuthPayload {
  userId: string;
  uId?: string;
  email?: string;
  role?: string;
  username: string;
  avatarColor: string;
  iat?: number;
}

export interface GooglePayload {
  email: string;
  password: string;
  username: string;
  avatarColor: string;
}

// Firebase Auth Payload Interface
export interface FirebaseAuthPayload {
  localId: string;
  email: string;
  displayName: string;
  photoUrl: string;
  emailVerified: boolean;
  providerUserInfo: ProviderUserInfo[];
  validSince?: string;
  lastLoginAt?: string;
  createdAt?: string;
  lastRefreshAt?: string;
}

export interface ProviderUserInfo {
  providerId: string;
  displayName: string;
  photoUrl: string;
  federatedId: string;
  email: string;
  rawId: string;
}

export interface IAuthDocument extends Document {
  _id: string | ObjectId;
  uId: string;
  role: string;
  username: string;
  email: string;
  password?: string;
  avatarColor: string;
  createdAt: Date;
  isBanned: boolean;
  bannedAt: Date | null;
  banReason: string | null;
  passwordResetToken?: string;
  passwordResetExpires?: number | string;
  provider?: string;
  providerId?: string;
  comparePassword(password: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
}

export interface ISignUpData {
  _id: ObjectId;
  uId: string;
  email: string;
  username: string;
  password: string;
  avatarColor: string;
}

export interface IAuthJob {
  value?: string | IAuthDocument | IUserDocument;
}
