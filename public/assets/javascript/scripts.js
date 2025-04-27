document.addEventListener('DOMContentLoaded', function () {
    // all certificates from MongoDB
    async function loadCertificates(lang) {
        const response = await fetch("/api/certificates");
        const certificates = await response.json();
        const certList = document.getElementById("cert-list");
        certList.innerHTML = "";

        certificates.reverse().forEach(cert => {
            const div = document.createElement("div");
            div.className = "row justify-content-center align-items-center mb-5";

            div.innerHTML = `
                <div class="col-12 text-center mb-3">
                    <h4><strong>${cert.date}</strong></h4>
                    <p style="font-size: 1.2rem;">${lang === 'ua' ? cert.descriptionUa : cert.descriptionEn}</p>
                </div>
                <div class="col-12 text-center">
                    <img src="${cert.imageUrl}" alt="Certificate Image" style="max-width: 100%; height: auto; border: 1px solid #ccc; padding: 5px; border-radius: 10px;">
                </div>
                <hr class="block__2_line my-5">
            `;
            certList.appendChild(div);
        });
    }

    // Подключаем к глобальному переключателю языка:
    window.onLanguageChange = loadCertificates;

    // И сразу загружаем при старте:
    loadCertificates(currentLanguage);
});


// Function to handle carousel slide event
const carouselElement = document.querySelector('#carousel');
carouselElement.addEventListener('slid.bs.carousel', function(event) {
    const activeIndex = event.to; // Get the index of the active item
    localStorage.setItem('activeCarouselIndex', activeIndex); // Save to localStorage
});

// Function to set the carousel to the last viewed item
function setCarouselToLastIndex() {
    const lastIndex = localStorage.getItem('activeCarouselIndex'); // Get the saved index
    if (lastIndex !== null) {
        const carousel = new bootstrap.Carousel(carouselElement);
        carousel.to(parseInt(lastIndex)); // Move to the saved index
    }
}

// Set the carousel to the last viewed index on page load
window.onload = setCarouselToLastIndex;