import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/auth-middleware';
import { CreateAnswer } from '@answers/controllers/create-answer';
import { GetAnswers } from '@answers/controllers/get-answer'

class AnswerRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    // Routes cho việc tạo answer
    this.router.post('/answer', authMiddleware.checkAuthentication, CreateAnswer.prototype.answer);
    
    // Routes cho việc lấy answers
    this.router.get('/question/:questionId/answers', GetAnswers.prototype.answers);

    return this.router;
  }
}

export const answerRoutes: AnswerRoutes = new AnswerRoutes();