// ------------------- Работа с проектами (с использованием GridFS) -------------------
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const Project = require('../models/Project');

const mongoURI = process.env.MONGODB_URI;

const conn = mongoose.createConnection(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

let gfs;
conn.once("open", () => {
    gfs = new GridFSBucket(conn.db, { bucketName: "projectImages" });
});

const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => ({
        filename: Date.now() + '-' + file.originalname,
        bucketName: "projectImages"
    })
});
const upload = multer({ storage });

// Получить все проекты
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Получить один проект по ID
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Получение изображения по имени файла
router.get('/image/:filename', async (req, res) => {
    const file = await conn.db.collection("projectImages.files").findOne({ filename: req.params.filename });
    if (!file) return res.status(404).json({ error: "Файл не найден" });

    const readStream = gfs.openDownloadStream(file._id);
    readStream.pipe(res);
});

// Создать новый проект
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { titleEn, descriptionEn, titleUa, descriptionUa } = req.body;
    const imageUrl = req.file ? `/api/projects/image/${req.file.filename}` : null;

    const newProject = new Project({
      titleEn,
      descriptionEn,
      titleUa,
      descriptionUa,
      imageUrl
    });

    await newProject.save();
    res.status(201).json(newProject);
  } catch (error) {
    console.error(error);  // Логируем ошибку
    res.status(500).json({ message: "Failed to create project" });
  }
});


// Обновить проект
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const { titleEn, descriptionEn, titleUa, descriptionUa } = req.body;
    if (titleEn) project.titleEn = titleEn;
    if (descriptionEn) project.descriptionEn = descriptionEn;
    if (titleUa) project.titleUa = titleUa;
    if (descriptionUa) project.descriptionUa = descriptionUa;
    if (req.file) project.imageUrl = `/api/projects/image/${req.file.filename}`;

    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Удалить проект
router.delete('/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
