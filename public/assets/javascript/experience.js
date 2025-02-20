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

});
