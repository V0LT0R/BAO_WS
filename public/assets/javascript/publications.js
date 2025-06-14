document.addEventListener('DOMContentLoaded', function () {

    //---------------------------------ORCID API--------------------------
    const orcidID = '0000-0001-9548-1959';
const apiURL = `https://pub.orcid.org/v3.0/${orcidID}/works`;

fetch(apiURL, {
    headers: { 'Accept': 'application/json' }
})
.then(response => response.json())
.then(data => {
    const works = data.group;

    works.sort((a, b) =>
        new Date(b['work-summary'][0]['publication-date']?.year?.value || 0) -
        new Date(a['work-summary'][0]['publication-date']?.year?.value || 0)
    );

    works.forEach(work => {
        const summary = work['work-summary'][0];
        const title = summary.title?.title?.value || 'No title';
        const year = summary['publication-date']?.year?.value || 'Unknown';

        // Пытаемся получить DOI (через external-id)
        let doi = null;
        const externalIds = summary['external-ids']?.['external-id'] || [];
        externalIds.forEach(id => {
            if (id['external-id-type'] === 'doi') {
                doi = id['external-id-value'];
            }
        });

        const doiUrl = doi ? `https://doi.org/${doi}` : null;

        // Создаём обёртку публикации
        const workWrapper = document.createElement('div');
        workWrapper.style.marginBottom = '15px';
        workWrapper.style.padding = '10px';
        workWrapper.style.borderBottom = '1px solid #ccc';
        workWrapper.style.display = 'flex';
        workWrapper.style.justifyContent = 'space-between';
        workWrapper.style.alignItems = 'center';

        const workText = document.createElement('div');
        workText.innerText = `${title} (${year})`;
        workText.style.flex = '1';

        const link = document.createElement('a');
        link.href = doiUrl || '#';
        link.target = '_blank';
        link.innerText = '🔗';
        link.title = doi ? 'Открыть публикацию по DOI' : 'DOI не найден';
        link.style.fontSize = '18px';
        link.style.textDecoration = 'none';
        link.style.marginLeft = '10px';
        link.style.transition = 'opacity 0.3s';
        link.style.opacity = doi ? '1' : '0.3'; // Если DOI нет — иконка тусклая
        link.onmouseover = () => link.style.opacity = doi ? '0.6' : '0.3';
        link.onmouseout = () => link.style.opacity = doi ? '1' : '0.3';

        workWrapper.appendChild(workText);
        if (doiUrl) workWrapper.appendChild(link);

        document.getElementById('publicationsOrchid').appendChild(workWrapper);
    });
})
.catch(error => {
    console.error('Error fetching works from ORCID:', error);
});

    
    //---------------------------------Scopus API--------------------------

const apiScopusKey = '602846c74bae196c1bc7b877f39029e7';  // твой ключ
const authorScopusId = '57190487952'; // Scopus ID автора
const apiScopusIdUrl = `https://api.elsevier.com/content/search/scopus?query=AU-ID(${authorScopusId})&apiKey=${apiScopusKey}`;

fetch(apiScopusIdUrl, {
    headers: {
        'Accept': 'application/json'
    }
})
.then(response => response.json())
.then(data => {
    const entries = data['search-results'].entry;

    entries.sort((a, b) => parseInt(b.coverDate) - parseInt(a.coverDate));

    entries.forEach(pub => {
        const title = pub['dc:title'] || 'No title';
        const year = pub['prism:coverDate']?.split('-')[0] || 'Unknown';
        const eid = pub['eid'];
        const scopusLink = `https://www.scopus.com/record/display.uri?eid=${eid}&origin=resultslist`;

        // Создание обёртки публикации
        const pubWrapper = document.createElement('div');
        pubWrapper.style.marginBottom = '15px';
        pubWrapper.style.padding = '10px';
        pubWrapper.style.borderBottom = '1px solid #ccc';
        pubWrapper.style.display = 'flex';
        pubWrapper.style.justifyContent = 'space-between';
        pubWrapper.style.alignItems = 'center';

        // Текст публикации
        const pubText = document.createElement('div');
        pubText.innerText = `${title} (${year})`;
        pubText.style.flex = '1';

        // Ссылка
        const link = document.createElement('a');
        link.href = scopusLink;
        link.target = '_blank';
        link.innerText = '🔗';
        link.title = 'Открыть в Scopus';
        link.style.fontSize = '18px';
        link.style.textDecoration = 'none';
        link.style.marginLeft = '10px';
        link.style.transition = 'opacity 0.3s';
        link.onmouseover = () => link.style.opacity = '0.6';
        link.onmouseout = () => link.style.opacity = '1';

        pubWrapper.appendChild(pubText);
        pubWrapper.appendChild(link);

        document.getElementById('publicationsScopus').appendChild(pubWrapper);
    });
})
.catch(error => {
    console.error('Error fetching data from Scopus API:', error);
});
    
});
