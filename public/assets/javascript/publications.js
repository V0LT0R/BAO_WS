document.addEventListener('DOMContentLoaded', function () {

    // ORCID API (оставляем без изменений)
    const orcidID = '0000-0001-9548-1959'; 
    const apiURL = `https://pub.orcid.org/v3.0/${orcidID}/works`;

    fetch(apiURL, {
        headers: { 'Accept': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        const works = data.group;

        works.sort((a, b) => new Date(b['work-summary'][0]['publication-date'].year.value) - new Date(a['work-summary'][0]['publication-date'].year.value));

        const latestWorks = works;

        latestWorks.forEach(work => {
            const title = work['work-summary'][0].title.title.value;
            const year = work['work-summary'][0]['publication-date'].year.value;

            const workElement = document.createElement('p');
            workElement.innerHTML = `${title} (${year})`;
            document.getElementById('publicationsOrchid').appendChild(workElement);
        });
    })
    .catch(error => {
        console.error('Error fetching works from ORCID:', error);
    });
    const apiScopusKey = '7043e23276fcf0651f6dabb42483fb72';  // вставь сюда свой Scopus API ключ
    const authorScopusId = '57190487952'; // вставь сюда Scopus ID автора
    const apiScopusIdUrl = `https://api.elsevier.com/content/search/scopus?query=AU-ID(${authorScopusId})&apiKey=${apiScopusKey}`;

    fetch(apiScopusIdUrl, {
        headers: {
            'Accept': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        const entries = data['search-results'].entry;

        // Сортировка по году (если есть)
        entries.sort((a, b) => parseInt(b.coverDate) - parseInt(a.coverDate));

        const latestPublications = entries;

        latestPublications.forEach(pub => {
            const title = pub['dc:title'] || 'No title';
            const year = pub['prism:coverDate']?.split('-')[0] || 'Unknown';

            const pubElement = document.createElement('p');
            pubElement.innerHTML = `${title} (${year})`;
            document.getElementById('publicationsScopus').appendChild(pubElement);
        });
    })
    .catch(error => {
        console.error('Error fetching data from Scopus API:', error);
    });

    const apiWoSKey = 'YOUR_WOS_API_KEY'; // вставь свой API-ключ от WoS
    const orcid = '0000-0001-9548-1959'; // или RID (ResearcherID), если используется он
    const apiWoSUrl = `https://api.clarivate.com/api/woslite/v1/wos?databaseId=WOS&usrQuery=ORCID:${orcid}&count=10&firstRecord=1`;

    fetch(apiWoSUrl, {
        headers: {
            'Accept': 'application/json',
            'X-ApiKey': apiWoSKey
        }
    })
    .then(response => response.json())
    .then(data => {
        const records = data.Data?.Records?.records || [];

        records.sort((a, b) => {
            const yearA = parseInt(a.static_data.summary.pub_info.year || '0');
            const yearB = parseInt(b.static_data.summary.pub_info.year || '0');
            return yearB - yearA;
        });

        const latest = records.slice(0, 3);

        latest.forEach(record => {
            const title = record.static_data.summary?.titles?.title?.find(t => t['type'] === 'item')?.content || 'No title';
            const year = record.static_data.summary.pub_info?.year || 'Unknown';

            const pubElement = document.createElement('p');
            pubElement.innerHTML = `${title} (${year})`;
            document.getElementById('wos-publications').appendChild(pubElement);
        });
    })
    .catch(error => {
        console.error('Error fetching data from Web of Science API:', error);
    });
    
});
