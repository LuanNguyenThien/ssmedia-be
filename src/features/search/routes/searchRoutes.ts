import { authMiddleware } from '@global/helpers/auth-middleware';
import express, { Router } from 'express';
import { Search } from '../controllers/search';

class SearchRoutes {
  private router: Router;
  constructor() {
    this.router = express.Router();
  }
  public routes(): Router {
    this.router.get('/search/:query', authMiddleware.checkAuthentication, Search.prototype.combinedSearch);
    this.router.post('/search/image', authMiddleware.checkAuthentication, Search.prototype.combinedSearch);
    return this.router;
  }
}

export const searchRoutes: SearchRoutes = new SearchRoutes();
