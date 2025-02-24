const express = require('express');
const router = express.Router();
const User = require('../models/Authorization');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { 
  registerValidation, 
  loginValidation, 
  validate 
} = require('../middlewares/authValidation');

const generateAccessToken = (id, role) => {
  const payload = {
      id,
      role 
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {expiresIn: "1h"} )
}

// Создать задачу (POST)
router.post("/register", registerValidation, validate, async (req, res) => {
  try {
    const {username, password, role} = req.body;
    const candidate = await User.findOne({username})
    if (candidate) {
        return res.status(400).json({message: "Пользователь с таким именем уже существует"})
    }
    const hashPassword = bcrypt.hashSync(password, 10);
    const user = new User({username, password: hashPassword, role})
    await user.save()
    return res.json({message: "Пользователь успешно зарегистрирован"})
} catch (e) {
    console.log(e)
    res.status(400).json({message: 'Registration error'})
}
});

router.post("/login", loginValidation, validate, async (req, res) => {
  try {
    const {username, password} = req.body
    const user = await User.findOne({username})
    if (!user) {
        return res.status(400).json({message: `Пользователь ${username} не найден`})
    }
    const validPassword = bcrypt.compareSync(password, user.password)
    if (!validPassword) {
        return res.status(400).json({message: `Введен неверный пароль`})
    }
    const token = generateAccessToken(user._id, user.role)
    return res.json({token})
} catch (e) {
    console.log(e)
    res.status(400).json({message: 'Login error'})
}
});

// Получить все задачи (GET)
router.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Обновить задачу (PUT)
router.put("/:id", async (req, res) => {
  try {
    const { currentPassword, newPassword, username } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    // Проверка текущего пароля
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ message: "Неверный пароль" });
    }

    // Обновление данных
    if (username) user.username = username;
    if (newPassword) {
      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    res.json({ message: "Данные обновлены", user });
  } catch (error) {
    console.error("Ошибка обновления:", error);
    res.status(500).json({ error: "Ошибка сервера" });
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