
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwtToken');
    if (!token) window.location.href = '/';
    
    const decodedToken = parseJwt(token);
    welcome(decodedToken.id)
    if (!decodedToken) {
      localStorage.removeItem('jwtToken');
      window.location.href = '/';
      return;
    }
  
    // Для admin.html проверяем роль
    if (window.location.pathname.includes('admin.html') && decodedToken.role !== 'admin') {
      window.location.href = 'user.html';
    };
    

  });
  async function welcome(id) {
    USER_API = `/api/user/${id}`
    const response = await fetch(USER_API);
    const users_reg = await response.json();
    const welcomeMessage = document.getElementById('accName');
    const userEdit = document.getElementById("user_edit");
    userEdit.innerHTML = "";
    const div = document.createElement("div");
    div.className = "row row-cols-1";
    div.innerHTML = `
                <div class="col mt-5">
                    <h1 id="accName">Welcome, ${users_reg.username}!</h1>
                </div>
                <div class="col mt-1">
                    <button  type="button" class="btn btn-light mb-2 border" onclick="editUser('${users_reg._id}', '${users_reg.username}')"><strong>Edit user</strong></button>
                </div>
    `;
    userEdit.appendChild(div);
    
  }
  function logout() {
    localStorage.removeItem('jwtToken');
    window.location.href = 'index.html';
  }
  function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
    } catch (e) {
        console.error('Ошибка парсинга токена:', e);
        return null;
    }
}


// Taking experience from MongoDB
const API_URL = "/api/experience";
const REG_API_URL = "/api/user";

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
                fetchExperiences();
            }
        }

        fetchExperiences();




async function fetchUsers() {
            const response = await fetch("/api/user/users");
            const users_reg = await response.json();
            const UserList = document.getElementById("user-list");
            UserList.innerHTML = "";
            
            users_reg.forEach(user1 => {
                const div1 = document.createElement("div");
                div1.className = "row justify-content-center align-items-center";
                div1.innerHTML = `
                        <div class="col-6 ">
                            <h2><strong>${user1.username}</strong></h2>
                        </div>
                        <div class="col-3 block__2_text">
                            <p style="font-size: 1.3rem;">
                                ${user1.role}
                            </p>
                        </div>
                        <div class="col-3 ">
                            <button onclick="deleteUser('${user1._id}')">Delete</button> 
                        </div>
                        
                `;
                UserList.appendChild(div1);
            });
        }

        async function registerUser() {
            const username = document.getElementById("newUsername").value;
            const password = document.getElementById("newPassword").value;
            const role = document.getElementById("newRole").value;
        
            await fetch("/api/user/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password, role }),
            });

            document.getElementById("newUsername").value = "";
            document.getElementById("newPassword").value = "";
            document.getElementById("newRole").value = "";
        

            fetchUsers()
        }
        
        async function deleteUser(id) {
            await fetch(`${REG_API_URL}/${id}`, { method: "DELETE" });
            fetchUsers();
        }

        async function editUser(id, oldUser) {
            const newUser = prompt("Edit Username:", oldUser);
            const checkPassword = prompt("Your Password: "); 
            const newPassword = prompt("Edit Password: ");
        
            if (newUser && checkPassword && newPassword) {
                // Отправляем данные на сервер для проверки и хэширования
                const response = await fetch(`/api/user/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: newUser,
                        currentPassword: checkPassword, // Пароль в открытом виде
                        newPassword: newPassword         // Новый пароль в открытом виде
                    })
                });
        
                if (response.ok) {
                    alert("Данные обновлены!");
                    welcome(id);
                } else {
                    alert("Ошибка: " + (await response.json()).message);
                }
            }
            fetchUsers()
        }


        async function uploadFile() {
            const formData = new FormData();
            const fileInput = document.getElementById("fileInput");
            if (fileInput.files.length === 0) {
                document.getElementById("message").innerText = "Выберите файл";
                return;
            }
            formData.append("file", fileInput.files[0]);

            const response = await fetch("/api/files/upload", {
                method: "POST",
                body: formData
            });
            const result = await response.json();
            document.getElementById("message").innerText = result.message;
            loadFiles();
        }

        async function loadFiles() {
            const response = await fetch("/api/files");
            const files = await response.json();
            const gallery = document.getElementById("fileGallery");
            gallery.innerHTML = "";
            files.forEach(file => {
                const img = document.createElement("img");
                img.src = `/api/files/${file.filename}`;
                
                gallery.appendChild(img);
            });
        }

        document.addEventListener("DOMContentLoaded", loadFiles);
        
        fetchExperiences();

        fetchUsers()