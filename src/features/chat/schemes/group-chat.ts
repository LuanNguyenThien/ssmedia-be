import Joi, {ObjectSchema} from 'joi';

const createGroupChatSchema: ObjectSchema = Joi.object().keys({
  name: Joi.string().required(),
  description: Joi.string().optional().allow(null, ''),
  members: Joi.array().items(Joi.string()).required().min(3).max(50).messages({
    'array.base': 'Members must be of type array',
    'array.min': 'Số lượng thành viên không đủ 3',
    'array.max': 'Số lượng thành viên vượt quá giới hạn 50',
    'string.base': 'Members must be of type string' // TODO: Check if this is correct
  }),
  groupPicture: Joi.string().optional().allow(null, '')
});

export {createGroupChatSchema};