// Set the Google Apps Script web app URL
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzuvfIe3lY9sqRkam4XrSbxJ5JHMbi1vX92FunQXzV_ESsqKZY6-Vuwp2Mi1gT1K8xJqQ/exec';

// Handle the Google Sign-In response
function handleCredentialResponse(response) {
    // Get the ID token from the response
    const idToken = response.credential;
    
    // Show loading message
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = 'Signing in...';
    statusMessage.classList.remove('d-none', 'alert-danger');
    statusMessage.classList.add('alert-info');
    
    // Parse the JWT to get user info
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    const userEmail = payload.email;
    
    // Verify if user has permission to use the app
    verifyPermission(userEmail, idToken)
        .then(hasPermission => {
            if (hasPermission) {
                // Store the token in localStorage for use in app.js
                localStorage.setItem('googleToken', idToken);
                
                // Store user information
                localStorage.setItem('userEmail', payload.email);
                localStorage.setItem('userName', payload.name);
                localStorage.setItem('userPicture', payload.picture);
                
                // Redirect to the task logger page
                statusMessage.textContent = 'Access granted. Redirecting...';
                setTimeout(() => {
                    window.location.href = 'app.html';
                }, 1000);
            } else {
                // User doesn't have permission
                throw new Error('You do not have permission to access this application. Please contact the administrator.');
            }
        })
        .catch(error => {
            // Show error message
            console.error('Permission check failed:', error);
            statusMessage.textContent = error.message || 'Authentication failed. Please try again.';
            statusMessage.classList.remove('alert-info');
            statusMessage.classList.add('alert-danger');
            
            // Clear any stored authentication data
            localStorage.removeItem('googleToken');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userName');
            localStorage.removeItem('userPicture');
        });
}

// Function to verify if the user has permission to access the app
async function verifyPermission(userEmail, idToken) {
    try {
        // Fix 1: Add credentials and mode to fetch options
        const fetchOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            mode: 'no-cors',
            cache: 'no-cache'
        };

        // Fix 2: Ensure proper URL encoding of parameters
        const url = `${SCRIPT_URL}?action=verifyPermission&email=${encodeURIComponent(userEmail)}`;
        
        console.log("Making request to:", url); // For debugging
        
        // Fix 3: Use the fetch options in the request
        const response = await fetch(url, fetchOptions);
        
        // Fix 4: Check for any type of successful response, not just 200 OK
        if (!response.ok) {
            console.error("Response status:", response.status);
            console.error("Response text:", await response.text());
            throw new Error(`Server responded with ${response.status}`);
        }
        
        // Fix 5: Properly handle JSON parsing errors
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
        throw new Error('Failed to verify access permissions. Please try again later.');
    }
}

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('googleToken');
    if (token) {
        // Very simple token validation (check if expired)
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiry = payload.exp * 1000; // Convert to milliseconds
            const userEmail = payload.email;
            
            if (Date.now() < expiry) {
                // Token still valid, verify permission again
                const statusMessage = document.getElementById('statusMessage');
                statusMessage.textContent = 'Verifying access...';
                statusMessage.classList.remove('d-none', 'alert-danger');
                statusMessage.classList.add('alert-info');
                
                verifyPermission(userEmail, token)
                    .then(hasPermission => {
                        if (hasPermission) {
                            // User still has permission, redirect to app
                            window.location.href = 'app.html';
                        } else {
                            throw new Error('Your access to this application has been revoked. Please contact the administrator.');
                        }
                    })
                    .catch(error => {
                        // Show error message
                        statusMessage.textContent = error.message;
                        statusMessage.classList.remove('alert-info');
                        statusMessage.classList.add('alert-danger');
                        
                        // Clear stored authentication data
                        localStorage.removeItem('googleToken');
                        localStorage.removeItem('userEmail');
                        localStorage.removeItem('userName');
                        localStorage.removeItem('userPicture');
                        
                        // Show login UI
                        document.querySelector('.login-container').style.display = 'block';
                    });
                
                return; // Prevent showing login UI while checking
            }
        } catch (e) {
            console.error('Invalid token', e);
        }
        
        // If we're here, token is invalid or expired
        localStorage.removeItem('googleToken');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('userPicture');
    }
    
    // Show login UI
    document.querySelector('.login-container').style.display = 'block';
});