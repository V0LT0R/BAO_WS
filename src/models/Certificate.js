const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  date: { type: String, required: true },
  descriptionEn: { type: String, required: true },
  descriptionUa: { type: String, required: true },
  imageUrl: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Certificate', certificateSchema);
