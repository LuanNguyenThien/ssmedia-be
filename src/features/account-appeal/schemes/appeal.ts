import Joi, { ObjectSchema } from 'joi';

const AppealSchema: ObjectSchema = Joi.object().keys({
  userId: Joi.string().optional().allow(null, ''),
  content: Joi.string().required().min(10).max(500)
});

export { AppealSchema};
