
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const AuthSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {type: String, default: "user"}
});


module.exports = mongoose.model('User', AuthSchema);