// middleware/authValidation.js
const { body, validationResult } = require('express-validator');

exports.registerValidation = [
  body('username')
    .notEmpty().withMessage('Username обязателен')
    .isLength({ min: 3 }).withMessage('Минимум 3 символа'),
  
  body('password')
    .notEmpty().withMessage('Пароль обязателен')
    .isLength({ min: 3 }).withMessage('Минимум 5 символов'),
  
  body('role')
    .notEmpty().withMessage('Роль обязательна')
    .isIn(['user', 'admin']).withMessage('Недопустимая роль'),
];

exports.loginValidation = [
  body('username')
    .notEmpty().withMessage('Username обязателен'),
  
  body('password')
    .notEmpty().withMessage('Пароль обязателен'),
];

exports.validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }
    next();
  };