document.addEventListener('DOMContentLoaded', function () {
    

    let currentTime = new Date();
    let day = currentTime.getDate();
    let monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    let month = monthNames[currentTime.getMonth()];
    let year = currentTime.getFullYear();
    let hour = currentTime.getHours();
    let min = currentTime.getMinutes();
    if (min < 10) {
        min = "0" + min;
    }
    let formattedDate = day + " " + month + " " + year + ", " + hour + ":" + min;
    document.getElementById("f1f").innerHTML = formattedDate;


    var points = [],
        velocity2 = 5, 
        canvas = document.getElementById('container'),
        context = canvas.getContext('2d'),
        radius = 5,
        boundaryX = 200,
        boundaryY = 200,
        numberOfPoints = 30;

    init();

    function init() {
        for (var i = 0; i < numberOfPoints; i++) {
            createPoint();
        }
        for (var i = 0, l = points.length; i < l; i++) {
            var point = points[i];
            if (i == 0) {
                points[i].buddy = points[points.length - 1];
            } else {
                points[i].buddy = points[i - 1];
            }
        }
        animate();
    }

    function createPoint() {
        var point = {}, vx2, vy2;
        point.x = Math.random() * boundaryX;
        point.y = Math.random() * boundaryY;
        point.vx = (Math.floor(Math.random()) * 2 - 1) * Math.random();
        vx2 = Math.pow(point.vx, 2);
        vy2 = velocity2 - vx2;
        point.vy = Math.sqrt(vy2) * (Math.random() * 2 - 1);
        points.push(point);
    }

    function resetVelocity(point, axis, dir) {
        var vx, vy;
        if (axis == 'x') {
            point.vx = dir * Math.random();
            vx2 = Math.pow(point.vx, 2);
            vy2 = velocity2 - vx2;
            point.vy = Math.sqrt(vy2) * (Math.random() * 2 - 1);
        } else {
            point.vy = dir * Math.random();
            vy2 = Math.pow(point.vy, 2);
            vx2 = velocity2 - vy2;
            point.vx = Math.sqrt(vx2) * (Math.random() * 2 - 1);
        }
    }

    function drawCircle(x, y) {
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * Math.PI, false);
        context.fillStyle = '#97badc';
        context.fill();
    }

    function drawLine(x1, y1, x2, y2) {
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.strokeStyle = '#8ab2d8';
        context.stroke();
    }

    function draw() {
        for (var i = 0, l = points.length; i < l; i++) {
            var point = points[i];
            point.x += point.vx;
            point.y += point.vy;
            drawCircle(point.x, point.y);
            drawLine(point.x, point.y, point.buddy.x, point.buddy.y);
            if (point.x < 0 + radius) {
                resetVelocity(point, 'x', 1);
            } else if (point.x > boundaryX - radius) {
                resetVelocity(point, 'x', -1);
            } else if (point.y < 0 + radius) {
                resetVelocity(point, 'y', 1);
            } else if (point.y > boundaryY - radius) {
                resetVelocity(point, 'y', -1);
            }
        }
    }

    function animate() {
        context.clearRect(0, 0, 200, 200);
        draw();
        requestAnimationFrame(animate);
    }

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
