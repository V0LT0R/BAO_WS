document.addEventListener('DOMContentLoaded', async function () {

    let projects = [];

    async function fetchProjects() {
        const response = await fetch('/api/projects');
        projects = await response.json();
    }

    async function loadProjects(lang) {
        const container = document.querySelector('.block__2');
        if (!container) return;

        let projectsList = document.getElementById('projects-list');
        if (projectsList) {
            projectsList.remove();
        }

        projectsList = document.createElement('div');
        projectsList.id = 'projects-list';
        container.appendChild(projectsList);

        projects.forEach(project => {
            const title = lang === 'ua' ? project.titleUa : project.titleEn;
            const description = lang === 'ua' ? project.descriptionUa : project.descriptionEn;

            const projectBlock = document.createElement('div');

            if (project.imageUrl) {
                projectBlock.innerHTML = `
                    <div class="row justify-content-center align-items-center">
                      <div class="col-6 block__2_text align-items-center">
                        <img src="${project.imageUrl}" alt="Project Image" class="img-fluid">
                      </div>
                      <div class="col-6 text-center">
                        <h2><strong>${title}</strong></h2>
                      </div>
                    </div>
                    <div class="row justify-content-center align-items-center">
                      <div style="margin-top: 50px; line-height: 35px;">
                        <p>${description}</p>
                      </div>
                    </div>
                    <hr class="block__2_line my-5">
                `;
            } else {
                projectBlock.innerHTML = `
                    <div class="row justify-content-center align-items-center">
                      <div class="col-8 text-center">
                        <h2><strong>${title}</strong></h2>
                      </div>
                    </div>
                    <div class="row justify-content-center align-items-center">
                      <div style="margin-top: 50px; line-height: 35px;">
                        <p>${description}</p>
                      </div>
                    </div>
                    <hr class="block__2_line my-5">
                `;
            }

            projectsList.appendChild(projectBlock);
        });
    }

    await fetchProjects();
    loadProjects(currentLanguage);

    // Глобальный хук для смены языка
    window.onProjectsLanguageChange = loadProjects;
});
