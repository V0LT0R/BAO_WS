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
        stars.forEach(star => {
            star.classList.add('star-shadow');
        });
        // Reset the color of all stars
        stars.forEach(s => s.style.color = 'gray');
        // Set the color of the selected star and all previous stars
        for (let i = 0; i <= index; i++) {
            stars[i].style.color = 'gold';
        }
    });
});

let changeTheme = 1;
let changeThemeBtn = document.getElementById('theme-btn');
let changeThemeBlock = document.getElementById('change-theme');
function ChangeTheme(){
    if (changeTheme == 1){
        changeThemeBtn.classList = '';
        changeThemeBtn.classList.toggle('change-theme-btn-day');
        changeThemeBlock.style.color = 'black';
        changeThemeBlock.style.background = '#fff'
        changeTheme = 0;
    } else {
        changeThemeBtn.classList = '';
        changeThemeBtn.classList.toggle('change-theme-btn-night');
        changeThemeBlock.style.color = 'white';
        changeThemeBlock.style.background = '#14213D'
        changeTheme = 1;
    }
}


const readMoreBtn = document.getElementById('readMoreBtn');
const moreText = document.getElementById('moreText');

readMoreBtn.addEventListener('click', () => {
    if (moreText.style.display === 'none') {
        moreText.style.display = 'block';
        readMoreBtn.textContent = 'Read Less';
    } else {
        moreText.style.display = 'none';
        readMoreBtn.textContent = 'Read More';
    }
});


// JavaScript to display the current time
const showTimeBtn = document.getElementById('showTimeBtn');
const timeDisplay = document.getElementById('timeDisplay');

showTimeBtn.addEventListener('click', () => {
    const currentTime = new Date().toLocaleTimeString();
    timeDisplay.textContent = `Current Time: ${currentTime}`;
});


// JavaScript for keyboard navigation
let activityItems = document.querySelectorAll('.activities');
let currentIndex = 0;

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



// JavaScript for multi-step form navigation
let currentStep = 1;
const totalSteps = 3;

// Show the correct step based on the current step
function showStep(step) {
    for (let i = 1; i <= totalSteps; i++) {
        document.getElementById(`step${i}`).style.display = i === step ? 'block' : 'none';
    }
}

// Callback function to handle navigation
function goToStep(step) {
    currentStep = step;
    showStep(currentStep);
}

// Event listeners for "Next" and "Back" buttons
document.getElementById('next1').addEventListener('click', () => goToStep(2));
document.getElementById('back1').addEventListener('click', () => goToStep(1));
document.getElementById('next2').addEventListener('click', () => goToStep(3));
document.getElementById('back2').addEventListener('click', () => goToStep(2));

// Submit event listener
document.getElementById('submit').addEventListener('click', () => {
    // Collect form data
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Simulate form submission
    console.log('Form submitted with:', { name, email, password });

    // Display a success message
    document.querySelector('.multi-step-form').style.display = 'none';
    document.getElementById('formFeedback').style.display = 'block';
});

// Initialize the first step
showStep(currentStep);


