document.addEventListener('DOMContentLoaded', function () {
    
    // API ----------------------------- \|/

    const orcidID = '0000-0001-9548-1959'; 
    const apiURL = `https://pub.orcid.org/v3.0/${orcidID}/works`;

    fetch(apiURL, {
        headers: {
            'Accept': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        const works = data.group;

        works.sort((a, b) => new Date(b['work-summary'][0]['publication-date'].year.value) - new Date(a['work-summary'][0]['publication-date'].year.value));

        const latestWorks = works.slice(0, 3);

        latestWorks.forEach(work => {
            const title = work['work-summary'][0].title.title.value;
            const year = work['work-summary'][0]['publication-date'].year.value;

            const workElement = document.createElement('p');
            workElement.innerHTML = `${title} (${year})`;
            document.getElementById('publications').appendChild(workElement);
        });
    })
    .catch(error => {
        console.error('Error fetching works from ORCID:', error);
    });

    // API ----------------------------- /|\
    
    // all experience from MongoDB
    async function loadExperiences(lang) {
        const response = await fetch("/api/experience");
        const experiences = await response.json();
        const expList = document.getElementById("exp-list");
        expList.innerHTML = "";
    
        experiences.reverse().forEach(exp => {
            const div = document.createElement("div");
            div.className = "row justify-content-center align-items-center";
            div.innerHTML = `
                <div class="col-4">
                    <h2><strong>${exp.year}</strong></h2>
                </div>
                <div class="col-7 block__2_text">
                    <p style="font-size: 1.3rem;">
                        ${lang === 'ua' ? exp.descriptionUa : exp.descriptionEn}
                    </p>
                </div>
                <hr class="block__2_line my-5">
            `;
            expList.appendChild(div);
        });
    }
    
    // Теперь подключаем к глобальному хук-переменной:
    window.onLanguageChange = loadExperiences;
    
    // И сразу загружаем при старте:
    loadExperiences(currentLanguage);

});
