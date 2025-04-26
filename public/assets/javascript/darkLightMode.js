const lightStyles = document.querySelectorAll('link[rel=stylesheet][media*=prefers-color-scheme][media*=light]');
const darkStyles = document.querySelectorAll('link[rel=stylesheet][media*=prefers-color-scheme][media*=dark]');
const darkSchemeMedia = matchMedia('(prefers-color-scheme: dark)');
const switcherRadios = document.querySelectorAll('.switcher__radio');
const navbar = document.getElementById('navbar');

const languageRadios = document.querySelectorAll('.language__radio');
let currentLanguage = getSavedLanguage() || 'en';

const translations = {
    en: {
        home: "Home",
        experience: "Experience",
        activity: "Activity",
        certificates: "Certificates",
        projects: "Projects",
        faqs: "FAQs",
        contact: "Contact",
        personalExperience: "Personal Experience",
        reflection: "Reflections on Life's Path: A Unique Journey of Growth and Learning",
        lifelongExperience: "Lifelong experience",
        delve: "Delve into the world of a dedicated professor and witness his unwavering pursuit of knowledge and aspirations.",
        educationExperience: "Education experience",
        lastPublications: "Last publications:",
    },
    ua: {
        home: "Головна",
        experience: "Досвід",
        activity: "Діяльність",
        certificates: "Сертифікати",
        projects: "Проєкти",
        faqs: "Питання",
        contact: "Контакт",
        personalExperience: "Особистий Досвід",
        reflection: "Роздуми над життєвим шляхом: Унікальна подорож зростання та навчання",
        lifelongExperience: "Життєвий досвід",
        delve: "Заглибтеся у світ відданого професора та станьте свідком його невтомного прагнення до знань і цілей.",
        educationExperience: "Освітній досвід",
        lastPublications: "Останні публікації:",
    }
};

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
    if (navbar.classList.contains('navbar-light')) {
        navbar.classList.remove('navbar-light', 'bg-light');
        navbar.classList.add('navbar-dark', 'bg-dark');
    } else {
        navbar.classList.remove('navbar-dark', 'bg-dark');
        navbar.classList.add('navbar-light', 'bg-light');
    }
}

function clearScheme() {
    localStorage.removeItem('color-scheme');
}

function setLanguage(lang) {
    saveLanguage(lang);
    currentLanguage = lang;
    updateLanguage(lang);
    updateLanguageSwitcherUI(lang);
    if (typeof onLanguageChange === 'function') {
        onLanguageChange(lang);
    }
}

function saveLanguage(lang) {
    localStorage.setItem('language', lang);
}

function getSavedLanguage() {
    return localStorage.getItem('language');
}

function updateLanguage(lang) {
    const dict = translations[lang];

    const elementsToUpdate = [
        { selector: ".nav-link[href='index.html']", key: 'home' },
        { selector: ".nav-link[href='experience.html']", key: 'experience' },
        { selector: ".nav-link[href='activity.html']", key: 'activity' },
        { selector: ".nav-link[href='certificates.html']", key: 'certificates' },
        { selector: ".nav-link[href='projects.html']", key: 'projects' },
        { selector: ".nav-link[href='FAQs.html']", key: 'faqs' },
        { selector: ".nav-link[href='#footer']", key: 'contact' },
        { selector: "#tmp-text", key: 'personalExperience' },
        { selector: ".header-text p", key: 'reflection' },
        { selector: ".block__2_header", key: 'lifelongExperience' },
        { selector: ".block__2_text p", key: 'delve' },
        { selector: "#block-2-bg h1:nth-of-type(2)", key: 'educationExperience' },
        { selector: "#publications h3", key: 'lastPublications' },
    ];

    elementsToUpdate.forEach(item => {
        const el = document.querySelector(item.selector);
        if (el) {
            if (item.selector === "#tmp-text" || item.selector === "#publications h3") {
                el.innerHTML = `<strong>${dict[item.key]}</strong>`;
            } else {
                el.textContent = dict[item.key];
            }
        }
    });
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

setupSwitcher();
setupScheme();
setupLanguageSwitcher();