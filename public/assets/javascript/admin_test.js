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
    fetchProjects();
    fetchCertificates();
    fetchActivities();

  });
  
  // Переменные API
  const API_URL = "/api/experience";
  const REG_API_URL = "/api/user";
  const PROJECT_API_URL = "/api/projects";
  const CERTIFICATE_API_URL = "/api/certificates";
  const ACTIVITY_API_URL = "/api/activities"; // <-- твой API для Activity

  
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
  
    experiences.reverse().forEach(exp => {
      const div = document.createElement("div");
      div.className = "row justify-content-center align-items-center mb-4 p-3 border rounded";
  
      div.innerHTML = `
        <div class="col-md-2">
          <h4><strong>${exp.year}</strong></h4>
        </div>
        <div class="col-md-6 block__2_text">
          <p style="font-size: 1.2rem;">${exp.descriptionEn}</p>
          <p style="font-size: 1.2rem;">${exp.descriptionUa}</p>
        </div>
        <div class="col-md-3 text-end">
          <button class="btn btn-light mb-2 border" onclick="editExp('${exp._id}', '${exp.year}', '${exp.descriptionEn}', '${exp.descriptionUa}')">Edit</button>
          <button class="btn btn-danger mb-2 border" onclick="deleteExp('${exp._id}')">Delete</button>
        </div>
      `;
  
      expList.appendChild(div);
    });
  }
  
  
  
  async function addExp() {
    const year = document.getElementById("expYear").value;
    const descriptionEn = document.getElementById("expDescriptionEn").value;
    const descriptionUa = document.getElementById("expDescriptionUa").value;
  
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, descriptionEn, descriptionUa })
    });
  
    document.getElementById("expYear").value = "";
    document.getElementById("expDescriptionEn").value = "";
    document.getElementById("expDescriptionUa").value = "";
  
    fetchExperiences();
  }
  
  async function deleteExp(id) {
    await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    fetchExperiences();
  }
  
  async function editExp(id, oldYear, oldDescriptionEn, oldDescriptionUa) {
    const editForm = document.getElementById("edit-exp-form");
    editForm.innerHTML = `
      <h4>Edit Experience</h4>
      <div class="mb-3">
        <label class="form-label">Year</label>
        <textarea id="editExpYear" class="form-control mb-2">${oldYear}</textarea>
      </div>
      <div class="mb-3">
        <label class="form-label">Experience Description English</label>
        <textarea id="editExpDescriptionEn" class="form-control mb-2">${oldDescriptionEn}</textarea>
      </div>
      <div class="mb-3">
        <label class="form-label">Experience Description Ukrainian</label>
        <textarea id="editExpDescriptionUa" class="form-control mb-2">${oldDescriptionUa}</textarea>
      </div>
      <button class="btn btn-success" onclick="updateExp('${id}')">Update</button>
      <button class="btn btn-secondary" onclick="cancelExpEdit()">Cancel</button>
    `;
    editForm.style.display = "block";
  }
  async function updateExp(id) {
    const year = document.getElementById("editExpYear").value;
    const descriptionEn = document.getElementById("editExpDescriptionEn").value;
    const descriptionUa = document.getElementById("editExpDescriptionUa").value;
  
    await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, descriptionEn, descriptionUa })
    });
  
    document.getElementById("edit-exp-form").style.display = "none";
    fetchExperiences();
  }
  function cancelExpEdit() {
    document.getElementById("edit-exp-form").style.display = "none";
  }
  
  
  // ------------------- Работа с активностями -------------------

async function fetchActivities() {
  const response = await fetch(ACTIVITY_API_URL);
  const activities = await response.json();
  const activityList = document.getElementById("activity-list");
  activityList.innerHTML = "";

  activities.reverse().forEach(activity => {
    const div = document.createElement("div");
    div.className = "row justify-content-center align-items-center mb-4 p-3 border rounded";

    div.innerHTML = `
      <div class="col-md-2">
        <h4><strong>${activity.year}</strong></h4>
      </div>
      <div class="col-md-6 block__2_text">
        <p style="font-size: 1.2rem;">${activity.descriptionEn}</p>
        <p style="font-size: 1.2rem;">${activity.descriptionUa}</p>
      </div>
      <div class="col-md-3 text-end">
        <button class="btn btn-light mb-2 border" onclick="editActivity('${activity._id}', '${activity.year}', decodeURIComponent('${encodeURIComponent(activity.descriptionEn)}'), decodeURIComponent('${encodeURIComponent(activity.descriptionUa)}'))">Edit</button>
        <button class="btn btn-danger mb-2 border" onclick="deleteActivity('${activity._id}')">Delete</button>
      </div>
    `;

    activityList.appendChild(div);
  });
}

async function addActivity() {
  const year = document.getElementById("activityYear").value;
  const descriptionEn = document.getElementById("activityDescriptionEn").value;
  const descriptionUa = document.getElementById("activityDescriptionUa").value;

  await fetch(ACTIVITY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, descriptionEn, descriptionUa })
  });

  document.getElementById("activityYear").value = "";
  document.getElementById("activityDescriptionEn").value = "";
  document.getElementById("activityDescriptionUa").value = "";

  fetchActivities();
}

async function deleteActivity(id) {
  await fetch(`${ACTIVITY_API_URL}/${id}`, { method: "DELETE" });
  fetchActivities();
}

async function editActivity(id, oldYear, oldDescriptionEn, oldDescriptionUa) {
  const editForm = document.getElementById("edit-activity-form");
  editForm.innerHTML = `
    <h4>Edit Activity</h4>
    <div class="mb-3">
      <label class="form-label">Year</label>
      <textarea id="editActivityYear" class="form-control mb-2">${oldYear}</textarea>
    </div>
    <div class="mb-3">
      <label class="form-label">Activity Description English</label>
      <textarea id="editActivityDescriptionEn" class="form-control mb-2" rows="3">${oldDescriptionEn}</textarea>
    </div>
    <div class="mb-3">
      <label class="form-label">Activity Description Ukrainian</label>
      <textarea id="editActivityDescriptionUa" class="form-control mb-2" rows="3">${oldDescriptionUa}</textarea>
    </div>
    <button class="btn btn-success" onclick="updateActivity('${id}')">Update</button>
    <button class="btn btn-secondary" onclick="cancelActivityEdit()">Cancel</button>
  `;
  editForm.style.display = "block";
}

async function updateActivity(id) {
  const year = document.getElementById("editActivityYear").value;
  const descriptionEn = document.getElementById("editActivityDescriptionEn").value;
  const descriptionUa = document.getElementById("editActivityDescriptionUa").value;

  await fetch(`${ACTIVITY_API_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, descriptionEn, descriptionUa })
  });

  document.getElementById("edit-activity-form").style.display = "none";
  fetchActivities();
}

function cancelActivityEdit() {
  document.getElementById("edit-activity-form").style.display = "none";
}

  
  
  // ------------------- Работа с пользователями -------------------
  async function fetchUsers() {
    const response = await fetch("/api/user/users");
    const users_reg = await response.json();
    const UserList = document.getElementById("user-list");
    UserList.innerHTML = "";
  
    users_reg.reverse().forEach(user => {
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
  
  // ------------------- Работа с проектами -------------------
  async function uploadProject() {
    const formData = new FormData();
    formData.append("titleEn", document.getElementById("ProjectTitleEn").value);
    formData.append("descriptionEn", document.getElementById("ProjectDescriptionEn").value);
    formData.append("titleUa", document.getElementById("ProjectTitleUa").value);
    formData.append("descriptionUa", document.getElementById("ProjectDescriptionUa").value);
    
    // Только если фото выбрано — добавляем его!
    const imageFile = document.getElementById("projectImage").files[0];
    if (imageFile) {
      formData.append("image", imageFile);
    }
    
    await fetch(PROJECT_API_URL, {
      method: "POST",
      body: formData
    });
  
    document.getElementById("ProjectTitleEn").value = "";
    document.getElementById("ProjectDescriptionEn").value = "";
    document.getElementById("ProjectTitleUa").value = "";
    document.getElementById("ProjectDescriptionUa").value = "";
    document.getElementById("projectImage").value = "";

  
    fetchProjects();
  }
  
  async function fetchProjects() {
    const response = await fetch(PROJECT_API_URL);
    const projects = await response.json();
    const projectList = document.getElementById("project-list");
    projectList.innerHTML = "";
  
    projects.reverse().forEach(project => {
      const div = document.createElement("div");
      div.className = "row justify-content-center align-items-center mb-4 p-3 border rounded";
  
      div.innerHTML = `
        ${project.imageUrl ? `
          <div class="col-md-2">
            <img src="${project.imageUrl}" alt="Project" class="img-fluid" style="max-height: 150px;">
          </div>
        ` : ''}
        <div class="${project.imageUrl ? 'col-md-6' : 'col-md-8'} block__2_text">
          <h5>${project.titleEn}</h5>
          <p>${project.descriptionEn}</p>
          <h5>${project.titleUa}</h5>
          <p>${project.descriptionUa}</p>
        </div>
        <div class="col-md-3 text-end">
          <button class="btn btn-light mb-2 border" onclick="editProjectForm('${project._id}')">Edit</button>
          <button class="btn btn-danger mb-2 border" onclick="deleteProject('${project._id}')">Delete</button>
        </div>
      `;
  
      projectList.appendChild(div);
    });
  }
  
  async function editProjectForm(id) {
    const response = await fetch(`${PROJECT_API_URL}/${id}`);
    const project = await response.json();
  
    const editForm = document.getElementById("edit-project-form");
    editForm.innerHTML = `
      <h4>Edit Project</h4>
      <textarea id="editProjectTitleEn" class="form-control mb-2">${project.titleEn}</textarea>
      <textarea id="editProjectDescriptionEn" class="form-control mb-2">${project.descriptionEn}</textarea>
      <textarea id="editProjectTitleUa" class="form-control mb-2">${project.titleUa}</textarea>
      <textarea id="editProjectDescriptionUa" class="form-control mb-2">${project.descriptionUa}</textarea>
      <input type="file" id="editProjectImage" class="form-control mb-2" accept="image/png">
      <button class="btn btn-success" onclick="updateProject('${project._id}')">Update</button>
      <button class="btn btn-secondary" onclick="cancelProjectEdit()">Cancel</button>
    `;
    editForm.style.display = "block";
  }
  
  async function updateProject(id) {
    const formData = new FormData();
    formData.append("titleEn", document.getElementById("editProjectTitleEn").value);
    formData.append("descriptionEn", document.getElementById("editProjectDescriptionEn").value);
    formData.append("titleUa", document.getElementById("editProjectTitleUa").value);
    formData.append("descriptionUa", document.getElementById("editProjectDescriptionUa").value);
  
    const imageFile = document.getElementById("editProjectImage").files[0];
    if (imageFile) {
      formData.append("image", imageFile);
    }
  
    await fetch(`${PROJECT_API_URL}/${id}`, {
      method: "PUT",
      body: formData
    });
  
    document.getElementById("edit-project-form").style.display = "none";
    fetchProjects();
  }
  
  async function deleteProject(id) {
    if (confirm("Are you sure you want to delete this project?")) {
      await fetch(`${PROJECT_API_URL}/${id}`, { method: "DELETE" });
      fetchProjects();
    }
  }
  
  function cancelProjectEdit() {
    document.getElementById("edit-project-form").style.display = "none";
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
          <p>${cert.descriptionEn}</p>
          <p>${ cert.descriptionUa}</p>
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
  