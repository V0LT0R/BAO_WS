const express = require("express");
const Experience = require("../models/Experince");
const router = express.Router();

// Создать задачу (POST)
router.post("/", async (req, res) => {
  try {
    const { year, description } = req.body;
    const newExp = new Experience({ year, description });
    await newExp.save();
    res.status(201).json(newExp);
  } catch (error) {
    res.status(500).json({ error: "Failed to create experiences" });
  }
});

// Получить все задачи (GET)
router.get("/", async (req, res) => {
  try {
    const exps = await Experience.find();
    res.json(exps);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch experiences" });
  }
});

// Обновить задачу (PUT)
router.put("/:id", async (req, res) => {
  try {
    const { title, description} = req.body;
    const updatedExp = await Experience.findByIdAndUpdate(
      req.params.id,
      { title, description},
      { new: true }
    );
    res.json(updatedExp);
  } catch (error) {
    res.status(500).json({ error: "Failed to update experiences" });
  }
});

// Удалить задачу (DELETE)
router.delete("/:id", async (req, res) => {
  try {
    await Experience.findByIdAndDelete(req.params.id);
    res.json({ message: "Experience deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete experiences" });
  }
});

module.exports = router;