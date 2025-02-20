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
                const div = document.createElement("div");
                div.className = "row justify-content-center align-items-center";
                div.innerHTML = `
                        <div class="col-3 ">
                            <h2><strong>${exp.year}</strong></h2>
                        </div>
                        <div class="col-6 block__2_text">
                            <p style="font-size: 1.3rem;">
                                ${exp.description}
                            </p>
                        </div>
                        <div class="col-3 ">
                            <button onclick="editExp('${exp._id}', '${exp.year}', '${exp.description}')">Edit</button>
                            <button onclick="deleteExp('${exp._id}')">Delete</button> 
                        </div>
                        
                `;
                expList.appendChild(div);
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

        async function deleteExp(id) {
            await fetch(`${API_URL}/${id}`, { method: "DELETE" });
            fetchExperiences();
        }

        async function editExp(id, oldYear, oldDescription) {
            const newYear = prompt("Edit Year:", oldYear);
            console.log(newYear);
            const newDescription = prompt("Edit Description:", oldDescription);
            if (newYear !== null && newDescription !== null) {
                await fetch(`${API_URL}/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({year: newYear, description: newDescription })
                });
                console.log(newYear);
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