const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  titleEn: { type: String, required: true, trim: true, maxlength: 500 },
  descriptionEn: { type: String, required: true, trim: true, maxlength: 20000 },
  titleUa: { type: String, required: true, trim: true, maxlength: 500 },
  descriptionUa: { type: String, required: true, trim: true, maxlength: 20000 },
  imageUrl: {
    type: String,
    default: null,
    maxlength: 2048,
    // Existing uploads can contain spaces and Unicode in their filenames.
    validate: {
      validator: value => value == null || /^\/api\/projects\/image\/[^/\\?#\u0000-\u001f\u007f]+$/u.test(value),
      message: 'Invalid project image URL.',
    },
  },
}, { timestamps: true, strict: 'throw', autoIndex: false, autoCreate: false });

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);
