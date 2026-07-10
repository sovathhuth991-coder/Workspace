// registration.js

// Function to handle form submission during registration
document.getElementById('registerForm').addEventListener('submit', function(event) {
    event.preventDefault();

    // Get input values
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!username || !email || !password) {
        alert('Please fill in all fields');
        return;
    }

    // Store user data locally
    let usersData = JSON.parse(localStorage.getItem('users')) || [];
    const newUser = { username, email, password };
    usersData.push(newUser);
    localStorage.setItem('users', JSON.stringify(usersData));

    alert('Registration successful!');
});

// Function to handle form submission during login and display data
document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();

    // Get input values for login
    const username = document.getElementById('username').value;

    if (!username) {
        alert('Please enter a username');
        return;
    }

    // Retrieve user data and display
    let usersData = JSON.parse(localStorage.getItem('users'));
    if (usersData && usersData.some(user => user.username === username)) {
        const userData = usersData.find(user => user.username === username);
        displayUserData(userData);
    } else {
        alert('User not found');
    }
});

// Function to display user data
function displayUserData(user) {
    const formDataDisplay = document.createElement('div');
    formDataDisplay.innerHTML = `
        <h2>User Data</h2>
        <p>Username: ${user.username}</p>
        <p>Email: ${user.email}</p>`;

    document.body.appendChild(formDataDisplay);
}
     const fs = require('fs');

     // Example data
     let content = 'Hello, world!';

     // Create a file named 'data.txt' in the current directory
     fs.writeFile('data.txt', content, (err) => {
       if (err) throw err;
       console.log('File saved successfully');
     });
     const axios = require('axios');

     // Example of fetching data from a HTTP endpoint
     axios.get('https://api.example.com/data')
       .then(response => {
         console.log(response.data);
       })
       .catch(error => {
         console.error('There was an error!', error);
       });
const axios = require('axios');
require('cron-time').set();

// Set a job to run every day at 8:00 AM (UTC) in Bangkok (UTC+7)
new CronJob("0 8 * * *", function() {
    console.log("Running task at 08:00 UTC, which is 15:00 in Bangkok time.");

    // Fetch data from an API
    axios.get('https://api.example.com/data')
      .then(response => {
        console.log(response.data);
      })
      .catch(error => {
        console.error('There was an error fetching the data!', error);
      });
}, null, true, 'UTC');
