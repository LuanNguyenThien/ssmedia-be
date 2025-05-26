import { ObjectId } from 'mongodb';
import { Request, Response } from 'express';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import { signupSchema } from '@auth/schemes/signup';
import { FirebaseAuthPayload, IAuthDocument, ISignUpData } from '@auth/interfaces/auth.interface';
import { authService } from '@service/db/auth.service';
import { Helpers } from '@global/helpers/helpers';
import { UploadApiResponse } from 'cloudinary';
import { uploads } from '@global/helpers/cloudinary-upload';
import HTTP_STATUS from 'http-status-codes';
import { IUserDocument } from '@user/interfaces/user.interface';
// import { UserCache } from '@service/redis/user.cache';
import JWT from 'jsonwebtoken';
import { authQueue } from '@service/queues/auth.queue';
import { userQueue } from '@service/queues/user.queue';
import { config } from '@root/config';
import { BadRequestError } from '@global/helpers/error-handler';
import { cache } from '@service/redis/cache';

// const userCache: UserCache = new UserCache();
const userCache = cache.userCache;

export class SignUp {
  @joiValidation(signupSchema)
  public async create(req: Request, res: Response): Promise<void> {
    const { username, email, password, avatarColor, avatarImage } = req.body;
    const checkIfUserExist: IAuthDocument = await authService.getUserByUsernameOrEmail(username, email);
    if (checkIfUserExist) {
      throw new BadRequestError('Invalid credentials');
    }

    const authObjectId: ObjectId = new ObjectId();
    const userObjectId: ObjectId = new ObjectId();
    const uId = `${Helpers.generateRandomIntegers(12)}`;
    // the reason we are using SignUp.prototype.signupData and not this.signupData is because
    // of how we invoke the create method in the routes method.
    // the scope of the this object is not kept when the method is invoked
    const authData: IAuthDocument = SignUp.prototype.signupData({
      _id: authObjectId,
      uId,
      username,
      email,
      password,
      avatarColor
    });
    const result: UploadApiResponse = (await uploads(avatarImage, `${userObjectId}`, true, true)) as UploadApiResponse;
    if (!result?.public_id) {
      throw new BadRequestError('File upload: Error occurred. Try again.');
    }

    // Add to redis cache
    const userDataForCache: IUserDocument = SignUp.prototype.userData(authData, userObjectId);
    userDataForCache.profilePicture = `https://res.cloudinary.com/di6ozapw8/image/upload/v${result.version}/${userObjectId}`;
    await userCache.saveUserToCache(`${userObjectId}`, uId, userDataForCache);

    // Add to database
    authQueue.addAuthUserJob('addAuthUserToDB', { value: authData });
    userQueue.addUserJob('addUserToDB', { value: userDataForCache });

    const userJwt: string = SignUp.prototype.signToken(authData, userObjectId);
    req.session = { jwt: userJwt };
    res.status(HTTP_STATUS.CREATED).json({ message: 'User created successfully', user: userDataForCache, token: userJwt });
  }

  public async createGoogleUser(payload: FirebaseAuthPayload): Promise<IAuthDocument> {
    const authObjectId: ObjectId = new ObjectId();
    const userObjectId: ObjectId = new ObjectId();
    const uId = `${Helpers.generateRandomIntegers(12)}`;

    // Generate username from email if not available
    const username = payload.displayName?.replace(/\s/g, '') || payload.email.split('@')[0];

    // Check if username exists and make it unique if needed
    const usernameExists = await authService.getAuthUserByUsername(username);
    const finalUsername = usernameExists ? `${username}${Helpers.generateRandomIntegers(4)}` : username;

    // Get random color
    const colors = [
      '#f44336',
      '#e91e63',
      '#9c27b0',
      '#673ab7',
      '#3f51b5',
      '#2196f3',
      '#03a9f4',
      '#00bcd4',
      '#009688',
      '#4caf50',
      '#8bc34a',
      '#cddc39',
      '#ffeb3b',
      '#ffc107',
      '#ff9800',
      '#ff5722'
    ];
    const randomIndex = Math.floor(Math.random() * colors.length);
    const avatarColor = colors[randomIndex];

    // Get provider info
    const providerInfo = payload.providerUserInfo?.[0];
    const providerId = providerInfo?.providerId || 'google.com';
    const federatedId = providerInfo?.federatedId || providerInfo?.rawId || payload.localId;

    // Create auth data
    const authData = {
      _id: authObjectId,
      uId,
      username: finalUsername,
      email: payload.email,
      avatarColor,
      provider: 'google',
      providerId: federatedId,
      createdAt: new Date(),
      role: 'USER',
      isBanned: false,
      bannedAt: null,
      banReason: null
    } as unknown as IAuthDocument;

    // Upload profile picture to Cloudinary if available
    let profilePictureUrl = '';
    if (payload.photoUrl) {
      try {
        const result: UploadApiResponse = await uploads(payload.photoUrl, `${userObjectId}`, true, true) as UploadApiResponse;
        if (result?.public_id) {
          profilePictureUrl = `https://res.cloudinary.com/di6ozapw8/image/upload/v${result.version}/${userObjectId}`;
        }
      } catch (error) {
        console.log('Error uploading Google profile picture to Cloudinary:', error);
        // Continue with empty profile picture if upload fails
      }
    }
    
    // Create user data
    const userDataForCache = {
      _id: userObjectId,
      authId: authObjectId,
      uId,
      username: finalUsername,
      email: payload.email,
      avatarColor,
      profilePicture: profilePictureUrl || '',
      blocked: [],
      blockedBy: [],
      work: '',
      location: '',
      school: '',
      quote: '',
      bgImageVersion: '',
      bgImageId: '',
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      notifications: {
        messages: true,
        reactions: true,
        comments: true,
        follows: true
      },
      social: {
        facebook: '',
        instagram: '',
        twitter: '',
        youtube: ''
      }
    } as unknown as IUserDocument;

    // Save to cache and database
    await userCache.saveUserToCache(`${userObjectId}`, uId, userDataForCache);
    authQueue.addAuthUserJob('addAuthUserToDB', { value: authData });
    userQueue.addUserJob('addUserToDB', { value: userDataForCache });

    return authData;
  }

  private signToken(data: IAuthDocument, userObjectId: ObjectId): string {
    return JWT.sign(
      {
        userId: userObjectId,
        uId: data.uId,
        email: data.email,
        role: 'user',
        username: data.username,
        avatarColor: data.avatarColor
      },
      config.JWT_TOKEN!
    );
  }

  private signupData(data: ISignUpData): IAuthDocument {
    const { _id, username, email, uId, password, avatarColor } = data;
    return {
      _id,
      uId,
      username: Helpers.firstLetterUppercase(username),
      email: Helpers.lowerCase(email),
      password,
      avatarColor,
      createdAt: new Date()
    } as IAuthDocument;
  }

  private userData(data: IAuthDocument, userObjectId: ObjectId): IUserDocument {
    const { _id, username, email, uId, password, avatarColor } = data;
    return {
      _id: userObjectId,
      authId: _id,
      uId,
      username: Helpers.firstLetterUppercase(username),
      email,
      password,
      avatarColor,
      profilePicture: '',
      blocked: [],
      blockedBy: [],
      work: '',
      location: '',
      school: '',
      quote: '',
      bgImageVersion: '',
      bgImageId: '',
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      notifications: {
        messages: true,
        reactions: true,
        comments: true,
        follows: true
      },
      social: {
        facebook: '',
        instagram: '',
        twitter: '',
        youtube: ''
      }
    } as unknown as IUserDocument;
  }
}
