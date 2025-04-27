const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  titleEn: { type: String, required: true },
  descriptionEn: { type: String, required: true },
  titleUa: { type: String, required: true },
  descriptionUa: { type: String, required: true },
  imageUrl: { type: String, required: false, default: null }, // <-- НЕобязательное поле
}, {
  timestamps: true
});

module.exports = mongoose.model('Project', projectSchema);
