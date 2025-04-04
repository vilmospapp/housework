// Set the Google Apps Script web app URL
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzuvfIe3lY9sqRkam4XrSbxJ5JHMbi1vX92FunQXzV_ESsqKZY6-Vuwp2Mi1gT1K8xJqQ/exec';

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
        // Call the Google Apps Script to verify permission
        const response = await fetch(`${SCRIPT_URL}?action=verifyPermission&email=${encodeURIComponent(userEmail)}`{
            headers: {
                "Access-Control-Allow-Origin": "*"
            }});
        
        if (!response.ok) {
            throw new Error('Failed to verify permissions');
        }
        
        const data = await response.json();
        
        if (data.status === 'error') {
            throw new Error(data.message || 'Permission check failed');
        }
        
        return data.hasPermission === true;
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
            email: userEmail, // This will be recorded in the spreadsheet
            token: localStorage.getItem('googleToken')
        };
        
        // Send data to Google Apps Script
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
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

// For PWA support
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('Service Worker registered', reg))
        .catch(err => console.error('Service Worker registration failed', err));
}