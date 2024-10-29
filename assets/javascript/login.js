// Проверка состояния при загрузке страницы
window.onload = () => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      showWelcomeMessage(storedUsername);
    } else {
      document.getElementById("registerForm").style.display = "block";
    }
  };
  
  // Переключение между формами
  function toggleForms(form) {
    document.getElementById("registerForm").style.display = form === 'register' ? "block" : "none";
    document.getElementById("loginForm").style.display = form === 'login' ? "block" : "none";
  }
  
  // Регистрация пользователя
  function register() {
    const username = document.getElementById("registerUsername").value;
    const password = document.getElementById("registerPassword").value;
  
    if (username && password) {
      if (localStorage.getItem(username)) {
        alert("Пользователь уже существует!");
      } else {
        const hashedPassword = btoa(password); // Простое шифрование пароля
        localStorage.setItem(username, hashedPassword);
        alert("Регистрация успешна! Теперь вы можете войти.");
        toggleForms('login');
      }
    } else {
      alert("Введите имя пользователя и пароль.");
    }
  }
  
  // Вход пользователя
  function login() {
    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;
    const hashedPassword = btoa(password);
  
    const storedPassword = localStorage.getItem(username);
    if (storedPassword && storedPassword === hashedPassword) {
      localStorage.setItem("username", username);
      showWelcomeMessage(username);
    } else {
      alert("Неверное имя пользователя или пароль.");
    }
  }
  
  // Выход пользователя
  function logout() {
    localStorage.removeItem("username");
    document.getElementById("welcome").style.display = "none";
    document.getElementById("loginForm").style.display = "block";
  }
  
  // Показать приветствие
  function showWelcomeMessage(username) {
    document.getElementById("registerForm").style.display = "none";
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("welcome").style.display = "block";
    document.getElementById("welcomeMessage").textContent = `Добро пожаловать, ${username}!`;
  }
  