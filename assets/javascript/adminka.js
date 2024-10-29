window.onload = () => {
    const storedUsername = localStorage.getItem("username");
    if (!storedUsername) {
        document.location.href = 'index.html';
    } else {
        showWelcomeMessage(storedUsername);
    }
};
function logout() {
    localStorage.removeItem("username");
    document.location.href = 'index.html'
  }

function showWelcomeMessage(username) {
    document.getElementById("welcomeMessage").textContent += ` ${username}!`;
}