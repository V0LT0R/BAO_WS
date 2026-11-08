const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  date: { type: String, required: true, trim: true, maxlength: 80 },
  descriptionEn: { type: String, required: true, trim: true, maxlength: 20000 },
  descriptionUa: { type: String, required: true, trim: true, maxlength: 20000 },
  imageUrl: {
    type: String,
    required: true,
    maxlength: 2048,
    match: /^\/api\/certificates\/image\/[^/\\?#\u0000-\u001f\u007f]+$/u,
  },
}, { timestamps: true, strict: 'throw', autoIndex: false, autoCreate: false });

module.exports = mongoose.models.Certificate || mongoose.model('Certificate', certificateSchema);
