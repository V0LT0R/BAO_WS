

//task 5
// Array of predefined colors using only blue shades
const colors = ["#87CEFA", "#00BFFF", "#1E90FF", "#4169E1", "#0000CD"];

// Function to change the background color
function changeBackgroundColor() {
    // Get a random color from the colors array
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    // Change the background color of the body
    document.body.style.backgroundColor = randomColor;
}

// Add event listener to the button
const button = document.getElementById("colorButton");
button.addEventListener("click", changeBackgroundColor);

//task 6 
let currentTime = new Date();
let day = currentTime.getDate();
let monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let month = monthNames[currentTime.getMonth()];
let year = currentTime.getFullYear();
let hour = currentTime.getHours();
let min = currentTime.getMinutes();

// Add leading zero to minutes if less than 10
if (min < 10) {
    min = "0" + min;
}

// Format the string
let formattedDate = day + " " + month + " " + year + ", " + hour + ":" + min;

document.getElementById("f1f").innerHTML = formattedDate;