const mongoose = require('mongoose');

// Keep the existing model and collection names to preserve stored content.
const experienceSchema = new mongoose.Schema({
  year: { type: String, required: true, trim: true, maxlength: 80 },
  descriptionEn: { type: String, required: true, trim: true, maxlength: 20000 },
  descriptionUa: { type: String, required: true, trim: true, maxlength: 20000 },
}, { strict: 'throw', autoIndex: false, autoCreate: false });

module.exports = mongoose.models.Experience || mongoose.model('Experience', experienceSchema);
