import Joi, { ObjectSchema } from 'joi';

const answerPostSchema: ObjectSchema = Joi.object().keys({
  questionId: Joi.string().required().messages({
    'string.base': 'Question ID must be of type string',
    'string.empty': 'Question ID is a required field'
  }),
  post: Joi.string().optional().allow(null, ''),
  htmlPost: Joi.string().required().messages({ // Answer luôn là HTML content
    'string.base': 'HTML content must be of type string',
    'string.empty': 'HTML content is a required field'
  }),
  bgColor: Joi.string().optional().allow(null, ''),
  privacy: Joi.string().optional().allow(null, ''),
  feelings: Joi.string().optional().allow(null, ''),
  gifUrl: Joi.string().optional().allow(null, ''),
  profilePicture: Joi.string().optional().allow(null, ''),
});

export { answerPostSchema };