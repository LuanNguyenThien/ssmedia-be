import Joi, { ObjectSchema } from 'joi';
const memberSchema = Joi.object({
  userId: Joi.string().length(24).required(),
  username: Joi.string().min(2).max(30).required(),
  avatarColor: Joi.string().allow('').optional(),
  profilePicture: Joi.string().uri().allow('').optional(),
  joinedAt: Joi.date().iso().required(),
  role: Joi.string().valid('admin', 'member').required(),
  joinedBy: Joi.string().valid('self', 'invited').required(),
  status: Joi.string().valid('pending', 'active', 'rejected').required(),
  invitedBy: Joi.string().length(24).allow('').optional()
});

const createGroupSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(1000).allow('').optional(),
  privacy: Joi.string().valid('public', 'private').optional().default('public'),
  profileImage: Joi.string().uri().allow('').optional(),
  tags: Joi.array().items(Joi.string().min(1).max(50)).optional(),
  category: Joi.array().items(Joi.string().min(1).max(50)).optional(),
  members: Joi.array().items(memberSchema).optional()
});

const updateGroupSchema: ObjectSchema = Joi.object().keys({
  name: Joi.string().min(2).max(100).optional().messages({
    'string.base': 'Group name must be a string',
    'string.min': 'Group name must have at least 2 characters',
    'string.max': 'Group name cannot exceed 100 characters'
  }),
  description: Joi.string().allow('').optional().max(1000).messages({
    'string.base': 'Description must be a string',
    'string.max': 'Description cannot exceed 1000 characters'
  }),
  privacy: Joi.string().valid('public', 'private').optional().messages({
    'string.base': 'Privacy setting must be a string',
    'any.only': 'Privacy must be either "public" or "private"'
  }),
  profileImage: Joi.string().uri().allow('').optional().messages({
    'string.base': 'Group profile image must be a string',
    'string.uri': 'Group profile image must be a valid URL'
  }),
  tags: Joi.array().items(Joi.string().min(1).max(50)).optional().messages({
    'array.base': 'Tags must be an array',
    'string.base': 'Each tag must be a string',
    'string.min': 'Each tag must have at least 1 character',
    'string.max': 'Each tag cannot exceed 50 characters'
  }),
  category: Joi.array().items(Joi.string().min(1).max(50)).optional().messages({
    'array.base': 'Category must be an array',
    'string.base': 'Each category must be a string',
    'string.min': 'Each category must have at least 1 character',
    'string.max': 'Each category cannot exceed 50 characters'
  })
});

const inviteMembersToGroupSchema: ObjectSchema = Joi.object().keys({
  userIds: Joi.array().items(Joi.string().required()).min(1).required().messages({
    'array.base': 'The list of user IDs to invite must be an array',
    'array.min': 'At least one user must be invited',
    'any.required': 'The list of user IDs to invite is a required field',
    'string.base': 'Each user ID must be a string'
  }),
  
});

const adminUpdateGroupMemberSchema: ObjectSchema = Joi.object().keys({
  role: Joi.string().valid('admin', 'member').optional().messages({
    'string.base': 'Role must be a string',
    'any.only': 'Role must be either "admin" or "member"'
  }),
  status: Joi.string().valid('pending', 'active', 'rejected').optional().messages({
    'string.base': 'Status must be a string',
    'any.only': 'Status must be "pending", "active", or "rejected"'
  })
});

const respondToGroupInvitationSchema: ObjectSchema = Joi.object().keys({
  action: Joi.string().valid('accept', 'decline').required().messages({
    'string.base': 'Action must be a string',
    'any.only': 'Action must be either "accept" or "decline"',
    'any.required': 'Action is a required field'
  })
});

const addMembersSchema = Joi.object({
  members: Joi.array().items(Joi.string().required()).min(1).required()
});

export {
  createGroupSchema,
  updateGroupSchema,
  inviteMembersToGroupSchema,
  adminUpdateGroupMemberSchema,
  respondToGroupInvitationSchema,
  addMembersSchema
};
