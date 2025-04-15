import Joi, { ObjectSchema } from 'joi';

const addChatSchema: ObjectSchema = Joi.object().keys({
  conversationId: Joi.string().optional().allow(null, ''),
  receiverId: Joi.string().optional().allow(null, ''),
  receiverUsername: Joi.string().optional().allow(null, ''),
  receiverAvatarColor: Joi.string().optional().allow(null, ''),
  receiverProfilePicture: Joi.string().optional().allow(null, ''),
  groupId: Joi.string().optional().allow(null, ''),
  body: Joi.string().optional().allow(null, ''),
  gifUrl: Joi.string().optional().allow(null, ''),
  selectedImage: Joi.string().optional().allow(null, ''),
  isRead: Joi.boolean().optional(),
  isGroupChat: Joi.boolean().optional(),
})
.xor('groupId', 'receiverId');

const markChatSchema: ObjectSchema = Joi.object().keys({
  senderId: Joi.string().required(),
  receiverId: Joi.string().required()
});

export { addChatSchema, markChatSchema };
