import { Request, Response } from 'express';
import { config } from '@root/config';
import JWT from 'jsonwebtoken';
import { joiValidation } from '@global/decorators/joi-validation.decorators';
import HTTP_STATUS from 'http-status-codes';
import { authService } from '@service/db/auth.service';
import { loginSchema } from '@auth/schemes/signin';
import { IAuthDocument, ISignUpData, FirebaseAuthPayload } from '@auth/interfaces/auth.interface';
import { BadRequestError } from '@global/helpers/error-handler';
import { userService } from '@service/db/user.service';
import { IUserDocument } from '@user/interfaces/user.interface';
import { cache } from '@service/redis/cache';
import { SignUp } from './signup';

const userCache = cache.userCache;

export class SignIn {
  @joiValidation(loginSchema)
  public async read(req: Request, res: Response): Promise<void> {
    const { username, password, provider, payload } = req.body;
    // Check which authentication method to use
    if (provider === 'google') {
      if (!payload || !payload.email) {
        throw new BadRequestError('Invalid Google authentication data');
      }

      // Check if user exists by email
      let existingUser: IAuthDocument = await authService.getAuthUserByEmail(payload.email);

      if (!existingUser) {
        // Create new user
        existingUser = await SignUp.prototype.createGoogleUser(payload);
      }
      // Generate tokens and send response
      await this.completeAuthentication(existingUser, req, res);
    } else {
      // Check if user exists by username or email
      const existingUser: IAuthDocument = await authService.getUserByUsernameOrEmail(username, username);
      if (!existingUser) {
        throw new BadRequestError('This account does not exist');
      }

      // Check password
      // For local accounts, ensure password exists and is correct
      if (existingUser.provider === 'google' && !existingUser.password) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          message: 'Please create a password for your account',
          needsPassword: true,
          email: existingUser.email
        });
        return;
      }

      const passwordsMatch: boolean = await existingUser.comparePassword(password);
      if (!passwordsMatch) {
        throw new BadRequestError('Password is incorrect');
      }

      // Generate tokens and send response
      await this.completeAuthentication(existingUser, req, res);
    }
  }

  private async completeAuthentication(existingUser: IAuthDocument, req: Request, res: Response): Promise<void> {
    // For Google authentication, we need to ensure user data is in database
    let user: IUserDocument | null = null;
    let retryCount = 0;
    const maxRetries = 5;

    while (!user && retryCount < maxRetries) {
      user = await userService.getUserByAuthId(`${existingUser._id}`);
      if (!user) {
        // Wait for 1 second before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
        retryCount++;
        console.log(`Retrying to get user data (${retryCount}/${maxRetries})...`);
      }
    }

    if (!user) {
      throw new BadRequestError('User data not found. Please try logging in again.');
    }

    const userJwt: string = JWT.sign(
      {
        userId: user._id,
        uId: existingUser.uId,
        role: existingUser.role,
        email: existingUser.email,
        username: existingUser.username,
        avatarColor: existingUser.avatarColor
      },
      config.JWT_TOKEN!
    );

    req.session = { jwt: userJwt };

    const userDocument: IUserDocument = {
      ...user,
      authId: existingUser!._id,
      username: existingUser!.username,
      email: existingUser!.email,
      avatarColor: existingUser!.avatarColor,
      uId: existingUser!.uId,
      createdAt: existingUser!.createdAt
    } as IUserDocument;

    res.status(HTTP_STATUS.OK).json({
      message: 'User login successfully',
      user: userDocument,
      token: userJwt
    });
  }

  public async checkBanStatus(req: Request, res: Response): Promise<void> {
    const { authId } = req.params;

    const isBanned = await authService.isUserBanned(authId);

    res.status(HTTP_STATUS.OK).json({ isBanned });
  }
}
