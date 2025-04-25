const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Certificate = require('../models/Certificate');

// Настройка хранения загруженных файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/certificates'); // путь куда сохраняем файлы
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Получить все сертификаты
router.get('/', async (req, res) => {
  try {
    const certificates = await Certificate.find().sort({ date: -1 });
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

// Создать новый сертификат
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { date, descriptionEn, descriptionUa } = req.body;
    const imageUrl = `/uploads/certificates/${req.file.filename}`;

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
    if (req.file) cert.imageUrl = `/uploads/certificates/${req.file.filename}`;

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
