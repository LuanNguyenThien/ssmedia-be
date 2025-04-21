import { Request, Response, NextFunction } from 'express';
import JWT from 'jsonwebtoken';
import { config } from '@root/config';
import { NotAuthorizedError } from '@global/helpers/error-handler';
import { AuthPayload } from '@auth/interfaces/auth.interface';

export class AuthMiddleware {
  public verifyUser(req: Request, _res: Response, next: NextFunction): void {
    let token = req.session?.jwt;
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    if (!token) {
      throw new NotAuthorizedError('Token is not available. Please login again.');
    }

    try {
      const payload: AuthPayload = JWT.verify(token, config.JWT_TOKEN!) as AuthPayload;
      req.currentUser = payload;
  

    } catch (error) {
      throw new NotAuthorizedError('Token is invalid. Please login again.');}
    next();
  }
  public verifyAdmin(req: Request, _res: Response, next: NextFunction): void {
  
    if (!req.session?.jwt) {
      throw new NotAuthorizedError('Token is not available. Please login again.');
    }

    try {
      const payload: AuthPayload = JWT.verify(req.session?.jwt, config.JWT_TOKEN!) as AuthPayload;
      req.currentUser = payload;
      
      if (payload.role !== 'ADMIN') {
        throw new NotAuthorizedError(`Access denied. Required role: ADMIN`);
      }
    } catch (error) {
      throw new NotAuthorizedError('Token is invalid. Please login again.');
    }
    next();
  }

  public checkAuthentication(req: Request, _res: Response, next: NextFunction): void {
    if (!req.currentUser) {
      throw new NotAuthorizedError('Authentication is required to access this route.');
    }
    next();
  }
}

export const authMiddleware: AuthMiddleware = new AuthMiddleware();
