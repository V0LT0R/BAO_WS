// ------------------- Работа с сертификатами (с использованием GridFS) -------------------
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const Certificate = require('../models/Certificate');

const mongoURI = process.env.MONGODB_URI;

const conn = mongoose.createConnection(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

let gfs;
conn.once("open", () => {
    gfs = new GridFSBucket(conn.db, { bucketName: "certificateImages" });
});

const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => ({
        filename: Date.now() + '-' + file.originalname,
        bucketName: "certificateImages"
    })
});
const upload = multer({ storage });

// Получить все сертификаты
router.get('/', async (req, res) => {
  try {
    const certificates = await Certificate.find().sort({ createdAt: -1 });
    res.json(certificates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Получить один сертификат по ID
router.get('/:id', async (req, res) => {
  try {
    const cert = await Certificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ message: 'Certificate not found' });
    res.json(cert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Получение изображения по имени файла
router.get('/image/:filename', async (req, res) => {
    const file = await conn.db.collection("certificateImages.files").findOne({ filename: req.params.filename });
    if (!file) return res.status(404).json({ error: "Файл не найден" });

    const readStream = gfs.openDownloadStream(file._id);
    readStream.pipe(res);
});

// Создать новый сертификат
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { date, descriptionEn, descriptionUa } = req.body;
    const imageUrl = `/api/certificates/image/${req.file.filename}`;

    const newCert = new Certificate({
      date,
      descriptionEn,
      descriptionUa,
      imageUrl
    });

    await newCert.save();
    res.status(201).json(newCert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Обновить сертификат
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const cert = await Certificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ message: 'Certificate not found' });

    const { date, descriptionEn, descriptionUa } = req.body;
    if (date) cert.date = date;
    if (descriptionEn) cert.descriptionEn = descriptionEn;
    if (descriptionUa) cert.descriptionUa = descriptionUa;
    if (req.file) cert.imageUrl = `/api/certificates/image/${req.file.filename}`;

    await cert.save();
    res.json(cert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Удалить сертификат
router.delete('/:id', async (req, res) => {
  try {
    const cert = await Certificate.findByIdAndDelete(req.params.id);
    if (!cert) return res.status(404).json({ message: 'Certificate not found' });
    res.json({ message: 'Certificate deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
