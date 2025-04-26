require("dotenv").config();
const express = require("express");
const path = require('path');
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const expRoutes = require("./src/routes/experience");
const authRoutes = require('./src/routes/user');
const projectRoutes = require("./src/routes/project");
const certificateRoutes = require('./src/routes/certificate');
const actRoutes = require('./src/routes/activity');


const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.static("public"));


// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Подключение к MongoDB

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('Failed to connect to MongoDB:', err));

// Раздача папки с картинками сертификатов
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Маршруты
app.use('/api/user', authRoutes);
app.use("/api/experience", expRoutes);
app.use("/api/projects", projectRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/activities', actRoutes);


const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
