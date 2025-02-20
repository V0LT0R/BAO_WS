require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const expRoutes = require("./src/routes/experience");

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

// Маршруты
app.use("/api/experience", expRoutes);

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
