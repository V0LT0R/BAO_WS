window.onload = () => {
    const storedUsername = localStorage.getItem("username");
    if (!storedUsername || storedUsername!='admin') {
        document.location.href = 'index.html';
    } else {
        displayUsers();
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

function displayUsers() {
    const usersContainer = document.getElementById("usersList");
    usersContainer.innerHTML = ''; 

    let users = JSON.parse(localStorage.getItem('users')) || [];
    if (users.length == 1) {
        usersContainer.classList.add('user-entry', 'd-flex', 'justify-content-between', 'align-items-center', 'my-4', 'user-text');
        usersContainer.innerHTML = '<p>No users registered.</p>';
    } else {
        users.forEach(user => {
            if (user != 'admin'){
                const userDiv = document.createElement('div');
                userDiv.classList.add('user-entry', 'd-flex', 'justify-content-between', 'align-items-center', 'my-4', 'user-text');
                userDiv.innerHTML = `
                    <span>${user}</span>
                    <button class="btn btn-danger btn-sm ml-5" onclick="deleteUser('${user}')">Delete</button>
                `;
            usersContainer.appendChild(userDiv);
            }
            
        });
    }
}

function deleteUser(username) {
    let users = JSON.parse(localStorage.getItem('users')) || [];
    users = users.filter(user => user !== username);
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.removeItem(username);
    displayUsers();
}

function addUser(username) {
    let users = JSON.parse(localStorage.getItem('users')) || [];
    users.push(username);
    localStorage.setItem('users', JSON.stringify(users)); 
    displayUsers();
}

function showWelcomeMessage(username) {
    document.getElementById("welcomeMessage").textContent += ` ${username}`;
    if(username !== "admin"){
    document.getElementById("userStatus").textContent += ` user`;
    }else {
        document.getElementById("userStatus").textContent += ` admin`;
    }
    
}