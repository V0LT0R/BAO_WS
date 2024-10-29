function validateForm() {
    let formBlock = document.getElementById('myForm');
    let popUpText = document.getElementById('pop-up');
    let email = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    let confirmPassword = document.getElementById('confirmPassword').value;

    document.getElementById('emailError').innerText = '';
    document.getElementById('passwordError').innerText = '';
    document.getElementById('confirmPasswordError').innerText = '';

    let valid = true;

    if (email === '') {
        document.getElementById('emailError').innerText = 'Email is required.';
        valid = false;
    } else if (!validateEmail(email)) {
        document.getElementById('emailError').innerText = 'Please enter a valid email address.';
        valid = false;
    }

    if (password === '') {
        document.getElementById('passwordError').innerText = 'Password is required.';
        valid = false;
    } else if (password.length < 8) {
        document.getElementById('passwordError').innerText = 'Password must be at least 8 characters long.';
        valid = false;
    }

    if (confirmPassword === '') {
        document.getElementById('confirmPasswordError').innerText = 'Please confirm your password.';
        valid = false;
    } else if (confirmPassword !== password) {
        document.getElementById('confirmPasswordError').innerText = 'Passwords do not match.';
        valid = false;
    }

    return valid; 
}

// Function to validate email format using regex
function validateEmail(email) {
    const emailPattern = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
    return emailPattern.test(email);
}

function toggleForm(){
    document.getElementById('myForm').style.display = "block";
}
function closeForm(){
    document.getElementById('myForm').style.display = "none";
}



// JavaScript to handle rating
let stars = document.querySelectorAll('.star');
stars.forEach((star, index) => {
    star.addEventListener('click', () => {
        // Reset the color of all stars
        stars.forEach(s => s.style.color = 'gray');
        // Set the color of the selected star and all previous stars
        for (let i = 0; i <= index; i++) {
            stars[i].style.color = 'gold';
        }
    });
});



// JavaScript for keyboard navigation
let currentIndex = 0;
let activityItems = document.querySelectorAll('.activities');


activityItems[currentIndex].focus();

document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
        currentIndex = (currentIndex + 1) % activityItems.length;
        activityItems[currentIndex].focus();
    } else if (event.key === 'ArrowUp') {
        currentIndex = (currentIndex - 1 + activityItems.length) % activityItems.length;
        activityItems[currentIndex].focus();
    }
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
        event.preventDefault(); // Prevent page scrolling
        currentIndex = (currentIndex + 1) % menuItems.length;
        menuItems[currentIndex].focus();
    } else if (event.key === 'ArrowUp') {
        event.preventDefault(); // Prevent page scrolling
        currentIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
        menuItems[currentIndex].focus();
    }
});


