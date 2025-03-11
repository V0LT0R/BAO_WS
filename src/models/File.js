const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema({
    filename: String,
    contentType: String,
    length: Number,
    uploadDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model("File", FileSchema, "uploads.files");
