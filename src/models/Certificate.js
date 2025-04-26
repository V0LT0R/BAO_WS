const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  date: { type: String, required: true },
  descriptionEn: { type: String, required: true },
  descriptionUa: { type: String, required: true },
  imageUrl: { type: String, required: true }, // тут хранится ссылка вида `/api/certificates/image/filename`
}, {
  timestamps: true // автоматически добавляет createdAt и updatedAt
});

module.exports = mongoose.model('Certificate', certificateSchema);
