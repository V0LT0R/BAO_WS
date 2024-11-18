const lightStyles = document.querySelectorAll('link[rel=stylesheet][media*=prefers-color-scheme][media*=light]');
const darkStyles = document.querySelectorAll('link[rel=stylesheet][media*=prefers-color-scheme][media*=dark]');
const darkSchemeMedia = matchMedia('(prefers-color-scheme: dark)');
const switcherRadios = document.querySelectorAll('.switcher__radio');
const navbar = document.getElementById('navbar');

const navImage = document.querySelectorAll('.navbar-img');

function setupSwitcher() {
    const savedScheme = getSavedScheme();



    if (savedScheme !== null) {
        const currentRadio = document.querySelector(`.switcher__radio[value=${savedScheme}]`);
        currentRadio.checked = true;
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
    if(savedScheme =="light"){
        navImage.forEach(s => s.style.filter = 'invert(0)');
        navImage[0].style.filter += 'drop-shadow(0 0 10px rgba(255, 136, 0, 1))';
    }else{
        navImage.forEach(s => s.style.filter = 'invert(1)');
        navImage[1].style.filter += 'drop-shadow(0 0 10px rgba(55, 0, 255, 1))';
    }

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
        if(scheme =="light"){
            navImage.forEach(s => s.style.filter = 'invert(0)');
            navImage[0].style.filter += 'drop-shadow(0 0 10px rgba(255, 136, 0, 1))';
        }else{
            navImage.forEach(s => s.style.filter = 'invert(1)');
            navImage[1].style.filter += 'drop-shadow(0 0 10px rgba(55, 0, 255, 1))';
        }
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

    if (darkScheme === true) {return'dark'}
    else return 'light'; 
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

setupSwitcher();
setupScheme();