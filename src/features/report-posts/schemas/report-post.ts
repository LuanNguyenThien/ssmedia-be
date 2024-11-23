import Joi, { ObjectSchema } from 'joi';

const ReportPostsSchema: ObjectSchema = Joi.object().keys({
  postId: Joi.string().required().messages({
    'any.required': 'postId is a required property'
  }),
  userId: Joi.string().optional().allow(null, '')
});

export { ReportPostsSchema};
