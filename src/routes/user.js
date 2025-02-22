const express = require('express');
const router = express.Router();
const User = require('../models/Authorization');

// Создать задачу (POST)
router.post("/", async (req, res) => {
  try {
    const { username, password } = req.body;
    const newUser = new User({ username, password });
    await newUser.save();
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Получить все задачи (GET)
router.get("/", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Обновить задачу (PUT)
router.put("/:id", async (req, res) => {
  try {
    const { username, password} = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { username, password},
      { new: true }
    );
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Удалить задачу (DELETE)
router.delete("/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

module.exports = router;