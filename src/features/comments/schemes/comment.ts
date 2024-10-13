import Joi, { ObjectSchema } from 'joi';

const addCommentSchema: ObjectSchema = Joi.object().keys({
  userTo: Joi.string().required().messages({
    'any.required': 'userTo is a required property'
  }),
  postId: Joi.string().required().messages({
    'any.required': 'postId is a required property'
  }),
  comment: Joi.alternatives().conditional('selectedImage', {
    is: Joi.string().optional().allow(null, ''),
    then: Joi.string().optional().allow(null, ''),
    otherwise: Joi.string().required().messages({
      'any.required': 'comment is a required property when selectedImage is not provided'
    })
  }),
  selectedImage: Joi.string().optional().allow(null, ''),
  profilePicture: Joi.string().optional().allow(null, ''),
  commentsCount: Joi.number().optional().allow(null, ''),
  parentId: Joi.string().optional().allow(null, '')
}).or('comment', 'selectedImage').messages({
  'object.missing': 'Either comment or selectedImage must be provided'
});

export { addCommentSchema };
