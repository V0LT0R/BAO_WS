const express = require("express");
const Activity = require("../models/Activity");
const router = express.Router();

// Создать активности (POST)
router.post("/", async (req, res) => {
  try {
    const { year, descriptionEn, descriptionUa } = req.body;
    const newAct = new Activity({ year, descriptionEn, descriptionUa });
    await newAct.save();
    res.status(201).json(newAct);
  } catch (error) {
    res.status(500).json({ error: "Failed to create activity" });
  }
});

// Получить активности (GET)
router.get("/", async (req, res) => {
  try {
    const acts = await Activity.find().sort({ year: -1 });
    res.json(acts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch activity" });
  }
});

// Обновить активности (PUT)
router.put("/:id", async (req, res) => {
  try {
    const { year, descriptionEn, descriptionUa } = req.body;
    const updatedAct = await Activity.findByIdAndUpdate(
      req.params.id,
      { year, descriptionEn, descriptionUa },
      { new: true }
    );
    res.json(updatedAct);
  } catch (error) {
    res.status(500).json({ error: "Failed to update activity" });
  }
});

// Удалить активности (DELETE)
router.delete("/:id", async (req, res) => {
  try {
    await Activity.findByIdAndDelete(req.params.id);
    res.json({ message: "Activity deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete activity" });
  }
});

module.exports = router;
