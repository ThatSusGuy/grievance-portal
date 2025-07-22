// Wait for the entire page to load before running the script
document.addEventListener('DOMContentLoaded', () => {

    // Initialize EmailJS with your Public Key
    (function(){
        emailjs.init("PoB9fcQiaekD1g8OI"); // ⚠️ PASTE YOUR PUBLIC KEY HERE
    })();

    // --- Days Counter Logic ---
    const startDate = new Date('2023-01-05T00:00:00'); // Your start date (Jan 5, 2023)
    const today = new Date();
    
    // Calculate the difference in milliseconds
    const differenceInMs = today - startDate;
    
    // Convert milliseconds to days (1000ms * 60s * 60min * 24hr)
    const msPerDay = 1000 * 60 * 60 * 24;
    const differenceInDays = Math.floor(differenceInMs / msPerDay);

    // Add 1 to make it inclusive
    const inclusiveDays = differenceInDays + 1;
    
    // Find the element on the page
    const counterElement = document.getElementById('days-counter');
    
    // We use innerHTML here to allow the <br> tag to create a line break.
    counterElement.innerHTML = `Today is day ${inclusiveDays}/∞ of our beautiful, crazy journey.<br><br>(Your man knows his numbers 😉)`;

    // Get references to all the elements we need to work with
    const welcomeScreen = document.getElementById('welcome-screen');
    const formScreen = document.getElementById('form-screen');
    const thanksScreen = document.getElementById('thanks-screen');

    const enterBtn = document.getElementById('enter-btn');
    const grievanceForm = document.getElementById('grievance-form');
    const submitAnotherBtn = document.getElementById('submit-another-btn');

    // --- EVENT LISTENERS ---

    // 1. When the "Enter" button is clicked on the welcome screen
    enterBtn.addEventListener('click', () => {
        welcomeScreen.style.display = 'none'; // Hide the welcome screen
        formScreen.style.display = 'flex';   // Show the form screen
    });

    // 2. When the grievance form is submitted
    grievanceForm.addEventListener('submit', function(event) {
        event.preventDefault(); // Stop the default form submission

        // Get the submit button and show a "sending..." state
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = "Sending...";

        // These are the variables we'll send to the EmailJS template
        const templateParams = {
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            mood: document.getElementById('mood').value,
            severity: document.getElementById('severity').value,
        };
        
        // Use EmailJS to send the email
        emailjs.send('service_t6m8a9b', 'grievance', templateParams) // ⚠️ PASTE YOUR TEMPLATE ID HERE
            .then(function(response) {
                console.log('SUCCESS!', response.status, response.text);
                
                // On success, hide the form and show the thank you screen
                formScreen.style.display = 'none';
                thanksScreen.style.display = 'flex';
                grievanceForm.reset(); // Reset the form fields
                submitBtn.disabled = false; // Re-enable the button
                submitBtn.innerHTML = "Submit ❤️"; // Reset button text

            }, function(error) {
                console.log('FAILED...', error);

                // On failure, alert the user and re-enable the form
                alert('Oops! Something went wrong and your grievance could not be sent. Please try again.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = "Submit ❤️";
            });
    });

    // 3. When the "Submit Another" button is clicked on the thank you screen
    submitAnotherBtn.addEventListener('click', () => {
        thanksScreen.style.display = 'none'; // Hide the thank you screen
        formScreen.style.display = 'flex';   // Show the form screen
    });

});