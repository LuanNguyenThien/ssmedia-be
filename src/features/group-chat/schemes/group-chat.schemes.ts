import Joi, { ObjectSchema } from 'joi';

const createGroupChatSchema: ObjectSchema = Joi.object().keys({
  name: Joi.string().min(3).max(50).required().messages({
    'string.base': 'Name must be of type string',
    'string.min': 'Name must have at least 3 characters',
    'string.max': 'Name must have at most 50 characters',
    'string.empty': 'Name is a required field'
  }),
  description: Joi.string().allow('').optional().max(200).messages({
    'string.base': 'Description must be of type string',
    'string.max': 'Description must have at most 200 characters'
  }),
  groupPicture: Joi.string().optional().allow('').messages({
    'string.base': 'Group picture must be of type string'
  }),
  members: Joi.array().items(Joi.string().required()).min(1).required().messages({
    'array.base': 'Members must be an array',
    'array.min': 'At least one member is required',
    'string.base': 'Member ID must be of type string'
  })
});

const updateGroupChatSchema: ObjectSchema = Joi.object().keys({
  name: Joi.string().min(3).max(50).optional().messages({
    'string.base': 'Name must be of type string',
    'string.min': 'Name must have at least 3 characters',
    'string.max': 'Name must have at most 50 characters'
  }),
  description: Joi.string().allow('').optional().max(200).messages({
    'string.base': 'Description must be of type string',
    'string.max': 'Description must have at most 200 characters'
  }),
  groupPicture: Joi.string().optional().allow('').messages({
    'string.base': 'Group picture must be of type string'
  })
});

const addMembersSchema: ObjectSchema = Joi.object().keys({
  members: Joi.array().items(Joi.string().required()).min(1).required().messages({
    'array.base': 'Members must be an array',
    'array.min': 'At least one member is required',
    'string.base': 'Member ID must be of type string'
  })
});

export { createGroupChatSchema, updateGroupChatSchema, addMembersSchema };
