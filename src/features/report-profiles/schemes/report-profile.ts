import Joi, { ObjectSchema } from 'joi';

const ReportProfilesSchema: ObjectSchema = Joi.object().keys({
  reporterId: Joi.string().optional().allow(null, ''),

  reportedUserId: Joi.string().required().messages({
    'any.required': 'reportedUserId là bắt buộc',
    'string.empty': 'reportedUserId không được để trống'
  }),

  reason: Joi.string().required().min(5).max(100).messages({
    'any.required': 'Lý do tố cáo là bắt buộc',
    'string.min': 'Lý do phải có ít nhất 5 ký tự',
    'string.max': 'Lý do tối đa 100 ký tự'
  }),

  description: Joi.string().optional().allow('', null).max(500).messages({
    'string.max': 'Mô tả tố cáo tối đa 500 ký tự'
  })
});

export { ReportProfilesSchema};
