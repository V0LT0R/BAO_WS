const express = require("express");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");
const File = require("../models/File");

const router = express.Router();
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/uploadDB";

const conn = mongoose.createConnection(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

let gfs;
conn.once("open", () => {
    gfs = new GridFSBucket(conn.db, { bucketName: "uploads" });
});

const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => ({
        filename: file.originalname,
        bucketName: "uploads"
    })
});
const upload = multer({ storage });

// Загрузка файла
router.post("/upload", upload.single("file"), (req, res) => {
    res.json({ file: req.file, message: "Файл успешно загружен!" });
});

// Получение списка файлов
router.get("/", async (req, res) => {
    const files = await conn.db.collection("uploads.files").find().toArray();
    res.json(files);
});

// Получение файла по имени
router.get("/:filename", async (req, res) => {
    const file = await conn.db.collection("uploads.files").findOne({ filename: req.params.filename });
    if (!file) {
        return res.status(404).json({ error: "Файл не найден" });
    }
    const readStream = gfs.openDownloadStream(file._id);
    readStream.pipe(res);
});

module.exports = router;