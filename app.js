// Set the Google Apps Script web app URL
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbze7-KixhxIXiTEEt65gacCiHnrNurYwAgF1M1N6wcj3v0N3VJc1NK_20rcBPOA-48RiA/exec';

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const token = localStorage.getItem('googleToken');
    if (!token) {
        // Not logged in, redirect to login page
        window.location.href = 'index.html';
        return;
    }
    
    // Extract user info from token
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userEmail = payload.email;
        
        // Verify permission again (in case permissions were revoked)
        verifyPermission(userEmail, token)
            .then(hasPermission => {
                if (!hasPermission) {
                    throw new Error('Your access to this application has been revoked.');
                }
                
                // User has permission, initialize the app
                initializeApp();

                // Fetch user summary data
                fetchUserSummary(userEmail);
            })
            .catch(error => {
                console.error('Permission error:', error);
                // Show error and redirect to login
                alert(error.message || 'Access denied. Redirecting to login page.');
                handleLogout();
            });
    } catch (e) {
        console.error('Token parsing error:', e);
        handleLogout();
    }
});

// Function to verify if the user has permission to access the app
async function verifyPermission(userEmail, idToken) {
    try {
        const url = `${SCRIPT_URL}?action=verifyPermission&email=${encodeURIComponent(userEmail)}`;
        
        console.log("Making request to:", url); // For debugging
        
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error("Response status:", response.status);
            console.error("Response text:", await response.text());
            throw new Error(`Server responded with ${response.status}`);
        }
        
        try {
            const data = await response.json();
            
            console.log("Response data:", data); // For debugging
            
            if (data.status === 'error') {
                throw new Error(data.message || 'Permission check failed');
            }
            
            return data.hasPermission === true;
        } catch (jsonError) {
            console.error("JSON parsing error:", jsonError);
            throw new Error('Invalid response format from server');
        }
    } catch (error) {
        console.error('Permission verification error:', error);
        throw new Error('Failed to verify access permissions');
    }
}



function initializeApp() {
    // Display user information
    const userProfilePic = document.getElementById('userProfilePic');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    
    userProfilePic.src = localStorage.getItem('userPicture') || 'icon.png';
    userName.textContent = localStorage.getItem('userName') || 'User';
    userEmail.textContent = localStorage.getItem('userEmail') || '';
    
    // Set default date to today
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    document.getElementById('dateInput').value = dateStr;
    
    // Set default time to now
    const timeStr = today.toTimeString().split(' ')[0].substring(0, 5);
    document.getElementById('timeInput').value = timeStr;
    
    // Add form submit handler
    const taskForm = document.getElementById('taskForm');
    taskForm.addEventListener('submit', handleFormSubmit);
    
    // Add logout handler
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', handleLogout);
}


// Update the handleFormSubmit function in app.js also
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.classList.remove('d-none', 'alert-success', 'alert-danger');
    statusMessage.classList.add('alert-info');
    statusMessage.textContent = 'Saving your task...';
    
    try {
        // Get form values
        const task = document.getElementById('taskSelect').value;
        const date = document.getElementById('dateInput').value;
        const time = document.getElementById('timeInput').value;
        const userEmail = localStorage.getItem('userEmail');
        
        // Validate email is available
        if (!userEmail) {
            throw new Error('User email not found. Please log in again.');
        }
        
        // Prepare data for submission
        const data = {
            task: task,
            date: date,
            time: time,
            email: userEmail,
            token: localStorage.getItem('googleToken')
        };
        
        // Send data to Google Apps Script with CORS options
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        // Handle non-OK responses
        if (!response.ok) {
            console.error("Response status:", response.status);
            console.error("Response text:", await response.text());
            throw new Error(`Server responded with ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            statusMessage.classList.remove('alert-info');
            statusMessage.classList.add('alert-success');
            statusMessage.textContent = 'Task saved successfully!';
            
            // Clear the task selection
            document.getElementById('taskSelect').selectedIndex = 0;
            
            // Keep the current date and time
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
            document.getElementById('dateInput').value = dateStr;
            
            const timeStr = today.toTimeString().split(' ')[0].substring(0, 5);
            document.getElementById('timeInput').value = timeStr;
            
            // Hide success message after a few seconds
            setTimeout(() => {
                statusMessage.classList.add('d-none');
            }, 3000);
        } else {
            throw new Error(result.message || 'Failed to save data');
        }
    } catch (error) {
        console.error('Error:', error);
        statusMessage.classList.remove('alert-info');
        statusMessage.classList.add('alert-danger');
        
        // Check if this is a permission error
        if (error.message && (
            error.message.includes('permission') || 
            error.message.includes('access') ||
            error.message.includes('Permission')
        )) {
            statusMessage.textContent = `Access denied: ${error.message}`;
            // Give the user time to read the message before redirecting
            setTimeout(() => {
                handleLogout();
            }, 3000);
        } else {
            statusMessage.textContent = `Error: ${error.message || 'Something went wrong'}`;
        }
    }
}

function handleLogout(event) {
    if (event) event.preventDefault();
    
    // Clear stored credentials
    localStorage.removeItem('googleToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userPicture');
    
    // Redirect to login page
    window.location.href = 'index.html';
}

// New function to fetch user summary
async function fetchUserSummary(userEmail) {
    try {
        // Show loading state
        document.getElementById('userEarnings').textContent = 'Loading...';
        document.getElementById('userTaskCount').textContent = '...';
        
        // Create a URL object for better handling of parameters
        const url = new URL(SCRIPT_URL);
        url.searchParams.append('action', 'getUserSummary');
        url.searchParams.append('email', userEmail);
        
        // Fetch summary data
        const response = await fetch(url.toString());
        
        // Check if response is OK
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        
        // Parse the JSON response
        const data = await response.json();
        
        if (data.status === 'error') {
            throw new Error(data.message || 'Failed to get summary data');
        }
        
        // Display summary data
        updateSummaryUI(data.summary);
    } catch (error) {
        console.error('Error fetching user summary:', error);
        document.getElementById('userEarnings').textContent = '$0.00';
        document.getElementById('userTaskCount').textContent = '0';
        document.getElementById('lastUpdated').textContent = `Error loading data: ${error.message}`;
    }
}

// Function to update the summary UI
function updateSummaryUI(summary) {
    // Format the earnings as currency
    const formattedEarnings = new Intl.NumberFormat('hu-HU', { 
        style: 'currency', 
        currency: 'Ft' 
    }).format(summary.totalEarnings);
    
    // Update the UI elements
    document.getElementById('userEarnings').textContent = formattedEarnings;
    document.getElementById('userTaskCount').textContent = summary.taskCount;
    
    // Format the last updated time
    const lastUpdated = new Date(summary.lastUpdated);
    document.getElementById('lastUpdated').textContent = `Frissítve: ${lastUpdated.toLocaleString()}`;
}


// For PWA support
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('Service Worker registered', reg))
        .catch(err => console.error('Service Worker registration failed', err));
}