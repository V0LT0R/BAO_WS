
  
  
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

  const REG_API_URL = "http://localhost:5000/api/user";

  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch (e) {
      return null;
    }
  }
  
  async function loginUser() {
    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;
    const errorElement = document.getElementById("loginError");
  
    try {
      const response = await fetch("http://localhost:5000/api/user/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.message || 'Ошибка входа');
      }
  
      // Сохраняем токен и перенаправляем
      localStorage.setItem('jwtToken', data.token);
      const decodedToken = parseJwt(data.token);
      
      if (decodedToken?.role === 'admin') {
        window.location.href = 'admin.html';
      } else if (decodedToken?.role === 'user') {
        window.location.href = 'user.html';
      } else {
        throw new Error('Неизвестная роль пользователя');
      }
  
    } catch (error) {
      errorElement.textContent = error.message;
      console.error('Login error:', error);
    }
  }
  
  // Обновленная функция проверки авторизации при загрузке
  window.onload = () => {
    const token = localStorage.getItem('jwtToken');
    if (!token) return;
  
    const decodedToken = parseJwt(token);
    if (!decodedToken) {
      localStorage.removeItem('jwtToken');
      return;
    }
  
    // Проверяем срок действия токена
    const isExpired = Date.now() >= decodedToken.exp * 1000;
    if (isExpired) {
      localStorage.removeItem('jwtToken');
      return;
    }
  
    // Автоматическое перенаправление
    if (decodedToken.role === 'admin') {
      window.location.href = 'admin.html';
    } else if (decodedToken.role === 'user') {
      window.location.href = 'user.html';
    }
  };

 function logout() {
  localStorage.removeItem('jwtToken');
  window.location.href = 'index.html';
}
  
  