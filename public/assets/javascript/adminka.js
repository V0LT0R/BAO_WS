
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
  
    // Для user.html проверяем роль
    if (window.location.pathname.includes('user.html') && decodedToken.role !== 'user') {
      window.location.href = 'admin.html';
    };
  });
  async function welcome(id) {
    USER_API = `http://localhost:5000/api/user/${id}`
    const response = await fetch(USER_API);
    const users_reg = await response.json();
    const welcomeMessage = document.getElementById('accName');
    welcomeMessage.textContent = `Welcome, ${users_reg.username}!`;
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
      return null;
    }
  }

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
        fetchExperiences();
    }
}

fetchExperiences();