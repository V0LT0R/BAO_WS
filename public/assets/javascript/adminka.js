document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwtToken');
    if (!token) window.location.href = '/';
    
    const decodedToken = parseJwt(token);
    if (!decodedToken) {
      localStorage.removeItem('jwtToken');
      window.location.href = '/';
      return;
    }
  
    // Для user.html проверяем роль
    if (window.location.pathname.includes('user.html') && decodedToken.role !== 'user') {
      window.location.href = 'admin.html';
    }
  });
  function logout() {
    localStorage.removeItem('jwtToken');
    window.location.href = 'index.html';
  }

function showWelcomeMessage(username) {
    document.getElementById("welcomeMessage").textContent += ` ${username}!`;
}