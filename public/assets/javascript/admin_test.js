// Проверка авторизации
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwtToken');
    if (!token) window.location.href = '/';
  
    const decodedToken = parseJwt(token);
    if (!decodedToken) {
      localStorage.removeItem('jwtToken');
      window.location.href = '/';
      return;
    }
  
    welcome(decodedToken.id);
  
    // Проверка роли для admin.html
    if (window.location.pathname.includes('admin.html') && decodedToken.role !== 'admin') {
      window.location.href = 'user.html';
    }
  
    // Загружаем начальные данные
    fetchExperiences();
    fetchUsers();
    loadFiles();
    fetchCertificates();
  });
  
  // Переменные API
  const API_URL = "/api/experience";
  const REG_API_URL = "/api/user";
  const FILES_API_URL = "/api/files";
  const CERTIFICATE_API_URL = "/api/certificates";
  
  // Переменная языка
  let currentLanguage = localStorage.getItem('language') || 'en';
  
  // JWT парсер
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
  
  // Выход
  function logout() {
    localStorage.removeItem('jwtToken');
    window.location.href = 'index.html';
  }
  
  // Приветствие пользователя
  async function welcome(id) {
    const response = await fetch(`/api/user/${id}`);
    const users_reg = await response.json();
    const userEdit = document.getElementById("user_edit");
    userEdit.innerHTML = `
      <div class="row row-cols-1">
        <div class="col mt-5">
          <h1 id="accName">Welcome, ${users_reg.username}!</h1>
        </div>
        <div class="col mt-1">
          <button type="button" class="btn btn-light mb-2 border" onclick="editUser('${users_reg._id}', '${users_reg.username}')"><strong>Edit user</strong></button>
        </div>
      </div>
    `;
  }
  
  // ------------------- Работа с опытом -------------------
  async function fetchExperiences() {
    const response = await fetch(API_URL);
    const experiences = await response.json();
    const expList = document.getElementById("exp-list");
    expList.innerHTML = "";
  
    experiences.forEach(exp => {
      const div = document.createElement("div");
      div.className = "row justify-content-center align-items-center";
      div.innerHTML = `
        <div class="col-3">
          <h2><strong>${exp.year}</strong></h2>
        </div>
        <div class="col-6 block__2_text">
          <p style="font-size: 1.3rem;">${exp.description}</p>
        </div>
        <div class="col-3">
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
    const newDescription = prompt("Edit Description:", oldDescription);
  
    if (newYear !== null && newDescription !== null) {
      await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: newYear, description: newDescription })
      });
      fetchExperiences();
    }
  }
  
  // ------------------- Работа с пользователями -------------------
  async function fetchUsers() {
    const response = await fetch("/api/user/users");
    const users_reg = await response.json();
    const UserList = document.getElementById("user-list");
    UserList.innerHTML = "";
  
    users_reg.forEach(user => {
      const div = document.createElement("div");
      div.className = "row justify-content-center align-items-center";
      div.innerHTML = `
        <div class="col-6">
          <h2><strong>${user.username}</strong></h2>
        </div>
        <div class="col-3 block__2_text">
          <p style="font-size: 1.3rem;">${user.role}</p>
        </div>
        <div class="col-3">
          <button onclick="deleteUser('${user._id}')">Delete</button>
        </div>
      `;
      UserList.appendChild(div);
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
  
    fetchUsers();
  }
  
  async function deleteUser(id) {
    await fetch(`${REG_API_URL}/${id}`, { method: "DELETE" });
    fetchUsers();
  }
  
  async function editUser(id, oldUser) {
    const newUser = prompt("Edit Username:", oldUser);
    const checkPassword = prompt("Your Password:");
    const newPassword = prompt("Edit Password:");
  
    if (newUser && checkPassword && newPassword) {
      const response = await fetch(`/api/user/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUser,
          currentPassword: checkPassword,
          newPassword: newPassword
        })
      });
  
      if (response.ok) {
        alert("Данные обновлены!");
        welcome(id);
      } else {
        alert("Ошибка: " + (await response.json()).message);
      }
    }
    fetchUsers();
  }
  
  // ------------------- Работа с файлами -------------------
  async function uploadFile() {
    const formData = new FormData();
    const fileInput = document.getElementById("fileInput");
    if (fileInput.files.length === 0) {
      document.getElementById("message").innerText = "Выберите файл";
      return;
    }
    formData.append("file", fileInput.files[0]);
  
    const response = await fetch(`${FILES_API_URL}/upload`, {
      method: "POST",
      body: formData
    });
    const result = await response.json();
    document.getElementById("message").innerText = result.message;
    loadFiles();
  }
  
  async function loadFiles() {
    const response = await fetch(FILES_API_URL);
    const files = await response.json();
    const gallery = document.getElementById("fileGallery");
    gallery.innerHTML = "";
  
    files.forEach(file => {
      const img = document.createElement("img");
      img.src = `/api/files/${file.filename}`;
      img.className = "img-fluid p-2";
      gallery.appendChild(img);
    });
  }
  
  // ------------------- Работа с сертификатами -------------------
  async function addCertificate() {
    const formData = new FormData();
    formData.append("date", document.getElementById("certDate").value);
    formData.append("descriptionEn", document.getElementById("certDescriptionEn").value);
    formData.append("descriptionUa", document.getElementById("certDescriptionUa").value);
    formData.append("image", document.getElementById("certImage").files[0]);
  
    await fetch(CERTIFICATE_API_URL, {
      method: "POST",
      body: formData
    });
  
    document.getElementById("certDate").value = "";
    document.getElementById("certDescriptionEn").value = "";
    document.getElementById("certDescriptionUa").value = "";
    document.getElementById("certImage").value = "";
  
    fetchCertificates();
  }
  
  async function fetchCertificates() {
    const response = await fetch(CERTIFICATE_API_URL);
    const certificates = await response.json();
    const certList = document.getElementById("cert-list");
    certList.innerHTML = "";
  
    certificates.forEach(cert => {
      const div = document.createElement("div");
      div.className = "row justify-content-center align-items-center mb-4 p-3 border rounded";
      div.innerHTML = `
        <div class="col-md-2">
          <img src="${cert.imageUrl}" alt="Certificate" class="img-fluid" style="max-height: 150px;">
        </div>
        <div class="col-md-4">
          <h5>${cert.date}</h5>
          <p>${currentLanguage === 'en' ? cert.descriptionEn : cert.descriptionUa}</p>
        </div>
        <div class="col-md-3">
          <button class="btn btn-light mb-2 border" onclick="editCertForm('${cert._id}')">Edit</button>
          <button class="btn btn-danger mb-2 border" onclick="deleteCert('${cert._id}')">Delete</button>
        </div>
      `;
      certList.appendChild(div);
    });
  }
  
  async function editCertForm(id) {
    const response = await fetch(`${CERTIFICATE_API_URL}/${id}`);
    const cert = await response.json();
  
    const editForm = document.getElementById("edit-cert-form");
    editForm.innerHTML = `
      <h4>Edit Certificate</h4>
      <textarea id="editCertDate" value="${cert.date}" class="form-control mb-2"></textarea>
      <textarea id="editCertDescriptionEn" class="form-control mb-2">${cert.descriptionEn}</textarea>
      <textarea id="editCertDescriptionUa" class="form-control mb-2">${cert.descriptionUa}</textarea>
      <input type="file" id="editCertImage" class="form-control mb-2" accept="image/png">
      <button class="btn btn-success" onclick="updateCert('${cert._id}')">Update</button>
      <button class="btn btn-secondary" onclick="cancelEdit()">Cancel</button>
    `;
    editForm.style.display = "block";
  }
  
  async function updateCert(id) {
    const formData = new FormData();
    formData.append("date", document.getElementById("editCertDate").value);
    formData.append("descriptionEn", document.getElementById("editCertDescriptionEn").value);
    formData.append("descriptionUa", document.getElementById("editCertDescriptionUa").value);
  
    const imageFile = document.getElementById("editCertImage").files[0];
    if (imageFile) {
      formData.append("image", imageFile);
    }
  
    await fetch(`${CERTIFICATE_API_URL}/${id}`, {
      method: "PUT",
      body: formData
    });
  
    document.getElementById("edit-cert-form").style.display = "none";
    fetchCertificates();
  }
  
  async function deleteCert(id) {
    if (confirm("Are you sure you want to delete this certificate?")) {
      await fetch(`${CERTIFICATE_API_URL}/${id}`, { method: "DELETE" });
      fetchCertificates();
    }
  }
  
  function cancelEdit() {
    document.getElementById("edit-cert-form").style.display = "none";
  }
  