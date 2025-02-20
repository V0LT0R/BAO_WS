window.onload = () => {
    const storedUsername = localStorage.getItem("username");
    if (!storedUsername || storedUsername!='admin') {
        document.location.href = 'index.html';
    } else {
        displayUsers();
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


// Taking experience from MongoDB
const API_URL = "http://localhost:5000/api/experience";

        async function fetchExperiences() {
            const response = await fetch(API_URL);
            const experiences = await response.json();
            const expList = document.getElementById("exp-list");
            expList.innerHTML = "";
            
            experiences.forEach(exp => {
                const li = document.createElement("li");
                li.className = "task-item";
                li.innerHTML = `
                    <div class="row justify-content-center align-items-center ">
                        <div class="col-4 ">
                            <h2><strong>${exp.year}</strong></h2>
                        </div>
                        <div class="col-7 block__2_text">
                            <p>
                                ${exp.description}
                            </p>
                        </div>
                    </div>
                    <hr class="block__2_line my-5">

                    
                `;
                expList.appendChild(li);
            });
        }

        async function addExp() {
            const year = document.getElementById("expYear").value;
            const description = document.getElementById("expDescription").value;

            await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ year, description })
            });

            document.getElementById("expYear").value = "";
            document.getElementById("expDescription").value = "";
            fetchExperiences();
        }

        async function deleteTask(id) {
            await fetch(`${API_URL}/${id}`, { method: "DELETE" });
            fetchExperiences();
        }

        async function editTask(id, oldTitle, oldDescription) {
            const newTitle = prompt("Edit Task Title:", oldTitle);
            const newDescription = prompt("Edit Task Description:", oldDescription);
            if (newTitle !== null && newDescription !== null) {
                await fetch(`${API_URL}/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: newTitle, description: newDescription })
                });
                fetchExperiences();
            }
        }

        async function toggleTask(id, completed) {
            await fetch(`${API_URL}/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completed: !completed })
            });
            fetchExperiences();
        }

        fetchExperiences();