// ----------------- Тема (Light / Dark) -----------------
const lightStyles = document.querySelectorAll('link[rel=stylesheet][media*=prefers-color-scheme][media*=light]');
const darkStyles = document.querySelectorAll('link[rel=stylesheet][media*=prefers-color-scheme][media*=dark]');
const darkSchemeMedia = matchMedia('(prefers-color-scheme: dark)');
const switcherRadios = document.querySelectorAll('.switcher__radio');
const navbar = document.getElementById('navbar');

// ----------------- Язык -----------------
const languageRadios = document.querySelectorAll('.language__radio');
let currentLanguage = getSavedLanguage() || 'en';

// ----------------- Переводы -----------------
const translations = {
    en: {
        // Навбар и футер
        home: "Home",
        experience: "Experience",
        activity: "Activity",
        certificates: "Certificates",
        projects: "Projects",
        faqs: "FAQs",
        contact: "Contact",
        contacts: "contact:",
        publications:"Publications",

        // Experience.html
        personalExperience: "Personal Experience",
        reflection: "Reflections on Life's Path: A Unique Journey of Growth and Learning",
        lifelongExperience: "Lifelong experience",
        delve: "Delve into the world of a dedicated professor and witness his unwavering pursuit of knowledge and aspirations.",
        educationExperience: "Education experience",
        publicationsOrcid: "Publications from ORCID:",
        publicationsScopus: "Publications from Scopus:",
        publicationsWoS: "Publications from Web of Science",

        // Activity.html
        researchActivites: "Pedagogical, State, Research Activities",
        advancingKnowledgeActivities: "Empowering Minds, Shaping Policy, Advancing Knowledge",
        activityLifelong: "Lifelong activity",
        activityDelve: "Delve into the world of a dedicated professor and witness his unwavering pursuit of knowledge and aspirations.",
        activityPedagogical: "Pedagogical activity",
        activityResearch: "Research activity",

        // Index.html
        index_name: "Biloshchytskyi Andrii",
        index_position: "Doctor of technical Science, Full Professor",
        index_university: "Astana IT University",
        index_vicerector: "Vice-Rector for Science and Innovation",
        index_expert: "Expert",
        index_areas: "In areas such as:",
        index_iot: "Internet of things",
        index_software: "Creation and apply software",
        index_equipment: "Creation of analytical and control equipment",
        index_information_systems: "Development and implementation of information systems",
        index_gis: "Geoinformation systems",
        index_networks: "In-depth knowledge of the principles of building computer networks and the operation of server equipment",
        index_teaching_exp: "TEACHING EXPERIENCE",
        index_teaching_years: "21 years",
        index_card_experience: "Experience",
        index_card_experience_desc: "Years of dedication in university and work",
        index_card_certificates: "Certificates",
        index_card_certificates_desc: "Confirmation of qualifications and achievements",
        index_card_activity: "Activity",
        index_card_activity_desc: "History, influence, progress",
        index_card_projects: "Responsible projects",
        index_card_projects_desc: "Innovations",

        // Projects.html
        projects_title: "Responsible Projects",
        projects_subtitle: "Revolutionizing Industries Through Cutting-Edge Endeavors",
        projects_main: "Projects",

        certificates_title: "Confirming Certificates",
        certificates_subtitle: "Validated and Acknowledged by Esteemed Industry Experts.",
        certificates_scancopies_button: "Scan-copies",
        certificates_certificates_of_honor: "Certificates of honor",
        certificates_part1_photo: "Photo confirming education experience",


    },
    ua: {
        // Навбар и футер
        home: "Головна",
        experience: "Досвід",
        activity: "Діяльність",
        certificates: "Сертифікати",
        projects: "Проєкти",
        faqs: "Питання",
        contact: "Контакти",
        contacts: "контакти:",
        publications: "Публікації",

        // Experience.html
        personalExperience: "Особистий Досвід",
        reflection: "Роздуми над життєвим шляхом: Унікальна подорож зростання та навчання",
        lifelongExperience: "Життєвий досвід",
        delve: "Заглибтеся у світ відданого професора та станьте свідком його невтомного прагнення до знань і цілей.",
        educationExperience: "Освітній досвід",
        publicationsOrcid: "Публікації з ORCID:",
        publicationsScopus: "Публікації зі Scopus:",
        publicationsWoS: "Публікації з Web of Science",

        // Activity.html
        researchActivites: "Педагогічна, державна, дослідницька діяльність",
        advancingKnowledgeActivities: "Розширення можливостей розуму, формування політики, поширення знань",
        activityLifelong: "Життєва діяльність",
        activityDelve: "Заглибтеся у світ відданого професора та станьте свідком його невтомного прагнення до знань і цілей.",
        activityPedagogical: "Педагогічна діяльність",
        activityResearch: "Дослідницька діяльність",

        // Index.html
        index_name: "Білощицький Андрій",
        index_position: "Доктор технічних наук, професор",
        index_university: "Астана IT Університет",
        index_vicerector: "Проректор з науки та інновацій",
        index_expert: "Експерт",
        index_areas: "У таких областях, як:",
        index_iot: "Інтернет речей",
        index_software: "Створення та застосування програмного забезпечення",
        index_equipment: "Створення аналітичного та контрольного обладнання",
        index_information_systems: "Розробка та впровадження інформаційних систем",
        index_gis: "Геоінформаційні системи",
        index_networks: "Глибокі знання принципів побудови комп'ютерних мереж та роботи серверного обладнання",
        index_teaching_exp: "ВИКЛАДАЦЬКИЙ ДОСВІД",
        index_teaching_years: "21 рік",
        index_card_experience: "Досвід",
        index_card_experience_desc: "Роки відданості університету та роботі",
        index_card_certificates: "Сертифікати",
        index_card_certificates_desc: "Підтвердження кваліфікацій та досягнень",
        index_card_activity: "Діяльність",
        index_card_activity_desc: "Історія, вплив, прогрес",
        index_card_projects: "Відповідальні проєкти",
        index_card_projects_desc: "Інновації",

        // Projects.html
        projects_title: "Відповідальні проєкти",
        projects_subtitle: "Революційні зміни у галузях завдяки передовим технологіям",
        projects_main: "Проєкти",

        certificates_title: "Підтвердження сертифікатів",
        certificates_subtitle: "Підтверджено та визнано провідними галузевими експертами.",
        certificates_scancopies_button: "Скан-копії",
        certificates_certificates_of_honor: "Почесні сертифікати",
        certificates_part1_photo: "Фото підтвердження освітнього досвіду",
    }
}

function updateLanguage(lang) {
    const dict = translations[lang];

    const elementsToUpdate = [
        { selector: ".to_home", key: 'home' },
        { selector: ".to_exp", key: 'experience' },
        { selector: ".to_act", key: 'activity' },
        { selector: ".to_cert", key: 'certificates' },
        { selector: ".to_proj", key: 'projects' },
        { selector: ".to_faq", key: 'faqs' },
        { selector: ".to_cont", key: 'contact' },
        { selector: ".contacts", key: 'contacts' },
        { selector: ".to_publ", key: 'publications' },

        { selector: ".personal_Experience", key: 'personalExperience', isStrong: true },
        { selector: ".reflection_exp", key: 'reflection' },
        { selector: "#lifelong_experience", key: 'lifelongExperience' },
        { selector: ".delve_exp", key: 'delve' },
        { selector: "#education_experience", key: 'educationExperience' },
        { selector: "#publicationsOrchid", key: 'publicationsOrcid', isStrong: true },
        { selector: "#publicationsScopus", key: 'publicationsScopus', isStrong: true },
        { selector: "#wos-publications", key: 'publicationsWoS', isStrong: true },

        { selector: ".Research_Activites", key: 'researchActivites', isStrong: true },
        { selector: ".activity_lifelong", key: 'activityLifelong', isStrong: true },
        { selector: ".activity_delve", key: 'activityDelve' },
        { selector: ".activity_pedagogical", key: 'activityPedagogical', isStrong: true },
        { selector: ".activity_research", key: 'activityResearch', isStrong: true },
        { selector: ".Advancing_Knowledge_activities", key: 'advancingKnowledgeActivities' },

        { selector: ".index_name", key: 'index_name', isStrong: true },
        { selector: ".index_position", key: 'index_position', isStrong: true },
        { selector: ".index_university", key: 'index_university' },
        { selector: ".index_vicerector", key: 'index_vicerector' },
        { selector: ".index_expert", key: 'index_expert' },
        { selector: ".index_areas", key: 'index_areas' },
        { selector: ".index_iot", key: 'index_iot' },
        { selector: ".index_software", key: 'index_software' },
        { selector: ".index_equipment", key: 'index_equipment' },
        { selector: ".index_information_systems", key: 'index_information_systems' },
        { selector: ".index_gis", key: 'index_gis' },
        { selector: ".index_networks", key: 'index_networks' },
        { selector: ".index_teaching_exp", key: 'index_teaching_exp' },
        { selector: ".index_teaching_years", key: 'index_teaching_years' },
        { selector: ".index_card_experience", key: 'index_card_experience' },
        { selector: ".index_card_experience_desc", key: 'index_card_experience_desc' },
        { selector: ".index_card_certificates", key: 'index_card_certificates' },
        { selector: ".index_card_certificates_desc", key: 'index_card_certificates_desc' },
        { selector: ".index_card_activity", key: 'index_card_activity' },
        { selector: ".index_card_activity_desc", key: 'index_card_activity_desc' },
        { selector: ".index_card_projects", key: 'index_card_projects' },
        { selector: ".index_card_projects_desc", key: 'index_card_projects_desc' },

        { selector: ".certificates_title", key: "certificates_title", isStrong: true },
        { selector: ".certificates_subtitle", key: "certificates_subtitle" },
        { selector: ".certificates_scancopies_button", key: "certificates_scancopies_button" },
        { selector: ".certificates_certificates_of_honor", key: "certificates_certificates_of_honor", isStrong: true },
        { selector: ".certificates_part1_photo", key: "certificates_part1_photo" },

        // Projects
        { selector: ".projects_title", key: 'projects_title', isStrong: true },
        { selector: ".projects_subtitle", key: 'projects_subtitle' },
        { selector: ".projects_main", key: 'projects_main', isStrong: true },
    
        
    ];

    elementsToUpdate.forEach(item => {
        const elements = document.querySelectorAll(item.selector);
        elements.forEach(el => {
            if (item.isStrong) {
                el.innerHTML = `<strong>${dict[item.key]}</strong>`;
            } else {
                el.textContent = dict[item.key];
            }
        });
    });
}
function setupSwitcher() {
    const savedScheme = getSavedScheme();
    if (savedScheme !== null) {
        const currentRadio = document.querySelector(`.switcher__radio[value=${savedScheme}]`);
        if (currentRadio) currentRadio.checked = true;
    }

    [...switcherRadios].forEach((radio) => {
        radio.addEventListener('change', (event) => {
            setScheme(event.target.value);
        });
    });
}

function setupScheme() {
    const savedScheme = getSavedScheme();
    const systemScheme = getSystemScheme();
    if (savedScheme === null) return;
    if (savedScheme !== systemScheme) {
        setScheme(savedScheme);
    }
}

function setScheme(scheme) {
    switchMedia(scheme);

    if (scheme === 'auto') {
        clearScheme();
    } else {
        saveScheme(scheme);
    }
}

function switchMedia(scheme) {
    let lightMedia;
    let darkMedia;

    if (scheme === 'auto') {
        lightMedia = '(prefers-color-scheme: light)';
        darkMedia = '(prefers-color-scheme: dark)';
    } else {
        lightMedia = (scheme === 'light') ? 'all' : 'not all';
        darkMedia = (scheme === 'dark') ? 'all' : 'not all';
    }

    [...lightStyles].forEach((link) => {
        link.media = lightMedia;
    });
    [...darkStyles].forEach((link) => {
        link.media = darkMedia;
    });
}

function getSystemScheme() {
    const darkScheme = darkSchemeMedia.matches;
    return darkScheme ? 'dark' : 'light';
}

function getSavedScheme() {
    return localStorage.getItem('color-scheme');
}

function saveScheme(scheme) {
    localStorage.setItem('color-scheme', scheme);
}

function clearScheme() {
    localStorage.removeItem('color-scheme');
}

// ----------------- Логика смены языка -----------------
function setupLanguageSwitcher() {
    const savedLanguage = getSavedLanguage();
    if (savedLanguage !== null) {
        const currentLangRadio = document.querySelector(`.language__radio[value=${savedLanguage}]`);
        if (currentLangRadio) currentLangRadio.checked = true;
        currentLanguage = savedLanguage;
        updateLanguage(savedLanguage);
        updateLanguageSwitcherUI(savedLanguage);
    }

    [...languageRadios].forEach((radio) => {
        radio.addEventListener('change', (event) => {
            setLanguage(event.target.value);
        });
    });
}

function getSavedLanguage() {
    return localStorage.getItem('language');
}

function saveLanguage(lang) {
    localStorage.setItem('language', lang);
}

function setLanguage(lang) {
    saveLanguage(lang);
    currentLanguage = lang;
    updateLanguage(lang);
    updateLanguageSwitcherUI(lang);

    // === СЮДА добавляем ===
    if (typeof onLanguageChange === 'function') {
        onLanguageChange(lang);
    }
    if (typeof onProjectsLanguageChange === 'function') {
        onProjectsLanguageChange(lang);
    }
}


function updateLanguageSwitcherUI(lang) {
    const switcher = document.querySelector('.language-switcher');
    if (!switcher) return;

    const enLabel = document.querySelector('label[for="lang-en"]');
    const uaLabel = document.querySelector('label[for="lang-ua"]');

    if (lang === 'en') {
        switcher.style.justifyContent = 'flex-start';
        if (enLabel) enLabel.style.color = 'white';
        if (uaLabel) uaLabel.style.color = 'black';
    } else {
        switcher.style.justifyContent = 'flex-end';
        if (enLabel) enLabel.style.color = 'black';
        if (uaLabel) uaLabel.style.color = 'white';
    }
}

// ----------------- Инициализация -----------------
setupSwitcher();
setupScheme();
setupLanguageSwitcher();
