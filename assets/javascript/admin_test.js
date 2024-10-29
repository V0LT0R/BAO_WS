window.onload = () => {
    const storedUsername = localStorage.getItem("username");
    if (!storedUsername || storedUsername!='admin') {
        document.location.href = 'index.html';
    } else {
        showWelcomeMessage(storedUsername);
    }
};