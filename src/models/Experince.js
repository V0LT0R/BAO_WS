const mongoose = require("mongoose");

const ExpSchema = new mongoose.Schema({
  year: { type: String, required: true },
  description: { type: String, required: true }
});

module.exports = mongoose.model("Experience", ExpSchema);
