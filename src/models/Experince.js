const mongoose = require('mongoose');

const ExpSchema = new mongoose.Schema({
  year: { type: String, required: true },
  descriptionEn: { type: String, required: true },
  descriptionUa: { type: String, required: true }
});

module.exports = mongoose.model('Experience', ExpSchema);
