const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  year: { type: String, required: true, trim: true, maxlength: 80 },
  descriptionEn: { type: String, required: true, trim: true, maxlength: 20000 },
  descriptionUa: { type: String, required: true, trim: true, maxlength: 20000 },
}, { strict: 'throw', autoIndex: false, autoCreate: false });

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
