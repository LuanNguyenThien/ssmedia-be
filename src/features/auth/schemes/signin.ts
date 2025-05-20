import Joi, { ObjectSchema } from 'joi';

const loginSchema: ObjectSchema = Joi.object().keys({
  username: Joi.string().allow('').optional(),
  password: Joi.string().allow('').optional(),
  provider: Joi.string().valid('local', 'google').required().messages({
    'any.required': 'Provider is required',
    'string.empty': 'Provider is required'
  }),
  payload: Joi.when('provider', {
    is: 'google',
    then: Joi.object().required().messages({
      'any.required': 'Google payload is required for Google authentication'
    }),
    otherwise: Joi.optional()
  })
}).or('username', 'payload').messages({
  'object.missing': 'Either username or Google payload is required'
});

export { loginSchema };
