// Array of predefined colors

// Function to change the background color of .block-2-bg

// Get the button and add an event listener
// document.getElementById('colorButton').addEventListener('click', changeBlockColor);


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