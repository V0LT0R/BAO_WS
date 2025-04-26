const express = require("express");
const Experience = require("../models/Experince");
const router = express.Router();

// Создать опыт (POST)
router.post("/", async (req, res) => {
  try {
    const { year, descriptionEn, descriptionUa } = req.body;
    const newExp = new Experience({ year, descriptionEn, descriptionUa });
    await newExp.save();
    res.status(201).json(newExp);
  } catch (error) {
    res.status(500).json({ error: "Failed to create experience" });
  }
});

// Получить весь опыт (GET)
router.get("/", async (req, res) => {
  try {
    const exps = await Experience.find().sort({ year: -1 });
    res.json(exps);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch experiences" });
  }
});

// Обновить опыт (PUT)
router.put("/:id", async (req, res) => {
  try {
    const { year, descriptionEn, descriptionUa } = req.body;
    const updatedExp = await Experience.findByIdAndUpdate(
      req.params.id,
      { year, descriptionEn, descriptionUa },
      { new: true }
    );
    res.json(updatedExp);
  } catch (error) {
    res.status(500).json({ error: "Failed to update experience" });
  }
});

// Удалить опыт (DELETE)
router.delete("/:id", async (req, res) => {
  try {
    await Experience.findByIdAndDelete(req.params.id);
    res.json({ message: "Experience deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete experience" });
  }
});

module.exports = router;
