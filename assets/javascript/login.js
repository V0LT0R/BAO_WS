// Проверка состояния при загрузке страницы
window.onload = () => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      showWelcomeMessage(storedUsername);
    } else {
      document.getElementById("registerForm").style.display = "block";
      document.getElementById("registerLink").classList.add("active-link");
      document.getElementById("loginLink").classList.add("passive_link");
    }
  };
  
  // Переключение между формами
  function toggleForms(form) {
      document.getElementById("registerForm").style.display = form === 'register' ? "block" : "none";
      document.getElementById("loginForm").style.display = form === 'login' ? "block" : "none";

      const loginLink = document.getElementById("loginLink");
      const registerLink = document.getElementById("registerLink");

      if (form === 'login') {
          loginLink.classList.remove("passive_link");
          loginLink.classList.add("active-link");
          registerLink.classList.remove("active-link");
          registerLink.classList.add("passive_link");
      } else {
          registerLink.classList.remove("passive_link");
          registerLink.classList.add("active-link");
          loginLink.classList.remove("active-link");
          loginLink.classList.add("passive_link");
  }
  }
  
  // Регистрация пользователя
  function register() {
    const username = document.getElementById("registerUsername").value;
    const password = document.getElementById("registerPassword").value;
  
    if (username && password) {
      if (localStorage.getItem(username)) {
        alert("Пользователь уже существует!");
      } else {
        const hashedPassword = btoa(password); 
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
  
  function logout() {
    localStorage.removeItem("username");
    document.location.href = 'index.html'
  }
  
  function showWelcomeMessage(username) {
    if (username === "admin" && window.location.pathname !== "/admin.html") {
      document.location.href = 'admin.html';
  } else if (username !== "admin" && window.location.pathname !== "/user.html") {
      document.location.href = 'user.html';
  }
  }
  