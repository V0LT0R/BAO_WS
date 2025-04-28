document.addEventListener('DOMContentLoaded', function () {
    let certificates = [];

    async function fetchCertificates() {
        const response = await fetch("/api/certificates");
        certificates = await response.json();
    }

    function renderCertificates(lang) {
        const certList = document.getElementById("cert-list");
        certList.innerHTML = "";

        [...certificates].reverse().forEach(cert => {
            const div = document.createElement("div");
            div.className = "row justify-content-center align-items-center mb-5";

            div.innerHTML = `
                <div class="col-12 text-center mb-3">
                    <h4><strong>${cert.date}</strong></h4>
                    <p style="font-size: 1.2rem;">${lang === 'ua' ? cert.descriptionUa : cert.descriptionEn}</p>
                </div>
                <div class="col-12 text-center">
                    <img src="${cert.imageUrl}" alt="Certificate Image" style="max-width: 100%; height: auto;">
                </div>
                <hr class="block__2_line my-5">
            `;
            certList.appendChild(div);
        });
    }

    async function initializeCertificates() {
        await fetchCertificates();
        renderCertificates(currentLanguage);
    }

    // Глобальный хук для смены языка
    window.onLanguageChange = renderCertificates;

    initializeCertificates();
});
