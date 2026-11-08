const mongoose = require('mongoose');

const authSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 64,
    match: /^[\p{L}\p{N}_.@-]{3,64}$/u,
  },
  // Hashing is explicit in the authentication service. Existing bcrypt hashes
  // remain valid; queries must opt in when verifying a password.
  password: { type: String, required: true, select: false, maxlength: 200 },
  role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
  authVersion: { type: Number, default: 0, min: 0, select: false, validate: Number.isSafeInteger },
}, {
  strict: 'throw',
  autoIndex: false,
  autoCreate: false,
  toJSON: { transform: redactPrivateFields },
  toObject: { transform: redactPrivateFields },
});

function redactPrivateFields(_document, value) {
  delete value.password;
  delete value.authVersion;
  delete value.__v;
  return value;
}

module.exports = mongoose.models.User || mongoose.model('User', authSchema);
