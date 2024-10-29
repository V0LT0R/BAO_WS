// Function to handle carousel slide event
const carouselElement = document.querySelector('#carousel');
carouselElement.addEventListener('slid.bs.carousel', function(event) {
    const activeIndex = event.to; // Get the index of the active item
    localStorage.setItem('activeCarouselIndex', activeIndex); // Save to localStorage
});

// Function to set the carousel to the last viewed item
function setCarouselToLastIndex() {
    const lastIndex = localStorage.getItem('activeCarouselIndex'); // Get the saved index
    if (lastIndex !== null) {
        const carousel = new bootstrap.Carousel(carouselElement);
        carousel.to(parseInt(lastIndex)); // Move to the saved index
    }
}

// Set the carousel to the last viewed index on page load
window.onload = setCarouselToLastIndex;