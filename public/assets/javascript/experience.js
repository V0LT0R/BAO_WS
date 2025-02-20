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

    const points = []; // Массив для хранения объектов Point
    const velocity2 = 5;
    const canvas = document.getElementById('container');
    const context = canvas.getContext('2d');
    const radius = 5;
    const boundaryX = 200;
    const boundaryY = 200;
    const numberOfPoints = 30;
    
    // Hide the canvas initially
    canvas.style.display = 'none';
    
    // Класс для точек
    class Point {
        constructor() {
            this.x = Math.random() * boundaryX;
            this.y = Math.random() * boundaryY;
            this.vx = (Math.floor(Math.random()) * 2 - 1) * Math.random();
            let vx2 = Math.pow(this.vx, 2);
            let vy2 = velocity2 - vx2;
            this.vy = Math.sqrt(vy2) * (Math.random() * 2 - 1);
        }
    
        // Метод для обновления позиции точки
        updatePosition() {
            this.x += this.vx;
            this.y += this.vy;
        }
    
        // Метод для сброса скорости
        resetVelocity(axis, dir) {
            if (axis == 'x') {
                this.vx = dir * Math.random();
                let vx2 = Math.pow(this.vx, 2);
                let vy2 = velocity2 - vx2;
                this.vy = Math.sqrt(vy2) * (Math.random() * 2 - 1);
            } else {
                this.vy = dir * Math.random();
                let vy2 = Math.pow(this.vy, 2);
                let vx2 = velocity2 - vy2;
                this.vx = Math.sqrt(vx2) * (Math.random() * 2 - 1);
            }
        }
    
        // Метод для рисования круга
        draw() {
            context.beginPath();
            context.arc(this.x, this.y, radius, 0, 2 * Math.PI, false);
            context.fillStyle = '#97badc';
            context.fill();
        }
    }
    
    function init() {
        // Создаём точки
        for (let i = 0; i < numberOfPoints; i++) {
            points.push(new Point());
        }
        // Устанавливаем связи между точками
        for (let i = 0; i < points.length; i++) {
            points[i].buddy = points[i === 0 ? points.length - 1 : i - 1];
        }
        animate();
    }
    
    function draw() {
        for (let point of points) {
            point.updatePosition(); // Обновляем позицию точки
            point.draw(); // Рисуем точку
            drawLine(point.x, point.y, point.buddy.x, point.buddy.y); // Рисуем линию
    
            // Проверяем границы и сбрасываем скорость
            if (point.x < radius) {
                point.resetVelocity('x', 1);
            } else if (point.x > boundaryX - radius) {
                point.resetVelocity('x', -1);
            } else if (point.y < radius) {
                point.resetVelocity('y', 1);
            } else if (point.y > boundaryY - radius) {
                point.resetVelocity('y', -1);
            }
        }
    }
    
    function drawLine(x1, y1, x2, y2) {
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.strokeStyle = '#8ab2d8';
        context.stroke();
    }
    
    function animate() {
        context.clearRect(0, 0, boundaryX, boundaryY);
        draw();
        requestAnimationFrame(animate);
    }
    
    // Show canvas and start animation on button click
    document.getElementById('showAnimation').addEventListener('click', () => {
        // Show the canvas
        canvas.style.display = 'block';
        
        // Hide the button
        document.getElementById('showAnimation').style.display = 'none';
        
        // Initialize the animation
        init();
    });
    
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
