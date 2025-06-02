import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { IPostDocument } from '@post/interfaces/post.interface';
import { postService } from '@service/db/post.service';

export class GetAnswers {
  public async answers(req: Request, res: Response): Promise<void> {
    const { questionId } = req.params;
    const { page = '1' } = req.query;
    const skip: number = (parseInt(page as string, 10) - 1) * 10;
    const limit: number = 10;
    let answers: IPostDocument[] = [];
    let answerCount = 0;
    
    answers = await postService.getAnswersForQuestion(questionId, skip, limit);
      
    // Đếm tổng số answer cho question
    answerCount = await postService.getAnswerCount(questionId);

    res.status(HTTP_STATUS.OK).json({ message: 'Answers fetched successfully', answers, count: answerCount });
  }
}