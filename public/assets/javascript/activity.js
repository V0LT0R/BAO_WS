document.addEventListener('DOMContentLoaded', function () {

    let activities = [];

    async function fetchActivities() {
        const response = await fetch("/api/activities");
        activities = await response.json();
    }

    function renderActivities(lang) {
        const actList = document.getElementById("act-list");
        actList.innerHTML = "";

        [...activities].reverse().forEach(act => {
            const div = document.createElement("div");
            div.className = "row justify-content-center align-items-center";
            div.innerHTML = `
                <div class="col-4">
                    <h2><strong>${act.year}</strong></h2>
                </div>
                <div class="col-7 block__2_text">
                    <p style="font-size: 1.3rem;">
                        ${lang === 'ua' ? act.descriptionUa : act.descriptionEn}
                    </p>
                </div>
                <hr class="block__2_line my-5">
            `;
            actList.appendChild(div);
        });
    }

    async function initializeActivities() {
        await fetchActivities();
        renderActivities(currentLanguage);
    }

    // Подключаем к глобальному переключателю языка:
    window.onLanguageChange = renderActivities;

    // И сразу загружаем при старте:
    initializeActivities();
});
