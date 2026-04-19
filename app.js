// Set the Google Apps Script web app URL
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbya-t80IUm-7xfid0-3ETIJ6eYzvdGWP2bUJTPYdbQZsyFYIX9hxg7NX1U5vqYcw2W5xA/exec'
;
let allUserRecords = [];

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
                fetchUserRecords(userEmail);
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

    // Add summary refresh button handler
    const refreshSummaryBtn = document.getElementById('refreshSummary');
    refreshSummaryBtn.addEventListener('click', () => {
        const userEmail = localStorage.getItem('userEmail');
        if (userEmail) {
            fetchUserSummary(userEmail);
        }
    });

    const refreshRecordsBtn = document.getElementById('refreshRecords');
    refreshRecordsBtn.addEventListener('click', () => {
        const userEmail = localStorage.getItem('userEmail');
        if (userEmail) {
            fetchUserRecords(userEmail);
        }
    });

    ['recordTaskFilter', 'recordSortBy', 'recordDateFrom', 'recordDateTo'].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('change', renderRecords);
    });
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
        
        // Prepare data for submission (action lets Code.gs doPost route to addTask)
        const data = {
            action: 'addTask',
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

            fetchUserSummary(userEmail);
            fetchUserRecords(userEmail);
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
        currency: 'HUF' 
    }).format(summary.totalEarnings);
    
    // Update the UI elements
    document.getElementById('userEarnings').textContent = formattedEarnings;
    document.getElementById('userTaskCount').textContent = summary.taskCount;
    
    // Format the last updated time
    const lastUpdated = new Date(summary.lastUpdated);
    document.getElementById('lastUpdated').textContent = `Frissítve: ${lastUpdated.toLocaleString()}`;
}

function setRecordsLoading(isLoading) {
    const loadingState = document.getElementById('recordsLoadingState');
    if (isLoading) {
        loadingState.classList.remove('d-none');
    } else {
        loadingState.classList.add('d-none');
    }
}

function setRecordsStatus(message, isError = false) {
    const statusEl = document.getElementById('recordsStatusMessage');
    if (!message) {
        statusEl.classList.add('d-none');
        statusEl.textContent = '';
        statusEl.classList.remove('text-danger');
        return;
    }
    statusEl.textContent = message;
    statusEl.classList.remove('d-none');
    statusEl.classList.toggle('text-danger', isError);
}

function setRecordsDebug(debugInfo) {
    const debugOutput = document.getElementById('recordsDebugOutput');
    if (!debugOutput) {
        return;
    }
    debugOutput.textContent = JSON.stringify(debugInfo, null, 2);
}

/**
 * Apps Script responses vary: { records }, { data: { records } }, or a top-level array.
 * Editor tests bypass the web app; deployed POST may only fill e.parameter if query string is used.
 */
function extractRecordsArray(data) {
    if (!data) {
        return { records: [], sourceKey: 'none' };
    }
    if (Array.isArray(data)) {
        return { records: data, sourceKey: 'root' };
    }
    if (typeof data !== 'object') {
        return { records: [], sourceKey: 'none' };
    }

    const tryKeys = [
        ['records', data.records],
        ['items', data.items],
        ['rows', data.rows],
        ['data.records', data.data && data.data.records],
        ['data', Array.isArray(data.data) ? data.data : null],
        ['result.records', data.result && data.result.records],
        ['result', Array.isArray(data.result) ? data.result : null]
    ];

    for (const [name, val] of tryKeys) {
        if (Array.isArray(val)) {
            return { records: val, sourceKey: name };
        }
    }

    for (const key of Object.keys(data)) {
        const val = data[key];
        if (Array.isArray(val) && val.length && (typeof val[0] === 'object' || Array.isArray(val[0]))) {
            return { records: val, sourceKey: key };
        }
    }

    return { records: [], sourceKey: 'none' };
}

function getTaskLabel(taskValue) {
    const taskSelect = document.getElementById('taskSelect');
    const option = Array.from(taskSelect.options).find(item => item.value === taskValue);
    return option ? option.textContent : taskValue || '-';
}

function normalizeRecord(record) {
    if (Array.isArray(record)) {
        // Expected order: [timestamp?, task, date, time, email?]
        const task = record[1] || record[0] || '';
        const date = record[2] || '';
        const time = record[3] || '';
        return { task: String(task || ''), date: String(date || ''), time: String(time || '') };
    }
    const task = record.task || record.taskId || record.taskType || '';
    const date = record.date || record.taskDate || '';
    const time = record.time || record.taskTime || '';
    return { task, date, time };
}

function getRecordTimestamp(record) {
    if (!record.date) {
        return 0;
    }
    const value = `${record.date}T${record.time || '00:00'}`;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDisplayDate(dateStr) {
    if (!dateStr) {
        return '-';
    }
    const date = new Date(`${dateStr}T00:00:00`);
    return Number.isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('hu-HU');
}

function renderRecords() {
    const taskFilter = document.getElementById('recordTaskFilter').value;
    const sortBy = document.getElementById('recordSortBy').value;
    const dateFrom = document.getElementById('recordDateFrom').value;
    const dateTo = document.getElementById('recordDateTo').value;
    const tableBody = document.getElementById('recordsTableBody');
    const emptyState = document.getElementById('recordsEmptyState');

    let records = [...allUserRecords];

    if (taskFilter !== 'all') {
        records = records.filter(record => record.task === taskFilter);
    }

    if (dateFrom) {
        records = records.filter(record => record.date && record.date >= dateFrom);
    }

    if (dateTo) {
        records = records.filter(record => record.date && record.date <= dateTo);
    }

    records.sort((a, b) => {
        if (sortBy === 'date-asc') {
            return getRecordTimestamp(a) - getRecordTimestamp(b);
        }
        if (sortBy === 'date-desc') {
            return getRecordTimestamp(b) - getRecordTimestamp(a);
        }
        const labelA = getTaskLabel(a.task).toLocaleLowerCase('hu-HU');
        const labelB = getTaskLabel(b.task).toLocaleLowerCase('hu-HU');
        if (sortBy === 'task-asc') {
            return labelA.localeCompare(labelB, 'hu-HU');
        }
        return labelB.localeCompare(labelA, 'hu-HU');
    });

    if (!records.length) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('d-none');
        setRecordsDebug({
            stage: 'renderRecords',
            totalFetchedRecords: allUserRecords.length,
            filteredRecords: 0,
            filters: { taskFilter, sortBy, dateFrom, dateTo }
        });
        return;
    }

    emptyState.classList.add('d-none');
    tableBody.innerHTML = records.map(record => `
        <tr>
            <td>${getTaskLabel(record.task)}</td>
            <td>${formatDisplayDate(record.date)}</td>
            <td>${record.time || '-'}</td>
        </tr>
    `).join('');

    setRecordsDebug({
        stage: 'renderRecords',
        totalFetchedRecords: allUserRecords.length,
        filteredRecords: records.length,
        filters: { taskFilter, sortBy, dateFrom, dateTo },
        firstRenderedRows: records.slice(0, 5)
    });
}

async function fetchUserRecords(userEmail) {
    const storedEmail = localStorage.getItem('userEmail');
    const token = localStorage.getItem('googleToken');

    try {
        setRecordsLoading(true);
        document.getElementById('recordsEmptyState').classList.add('d-none');
        setRecordsStatus('');

        // JSON body + text/plain (simple CORS POST). Put only action on the URL so
        // doPost can branch on e.parameter.action before JSON.parse; email+token stay in body.
        const postPayload = {
            action: 'getUserRecords',
            recordsQuery: true,
            email: userEmail,
            token: token
        };

        const url = new URL(SCRIPT_URL);
        url.searchParams.set('action', 'getUserRecords');
        url.searchParams.set('records', '1');

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=UTF-8'
            },
            body: JSON.stringify(postPayload),
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (parseError) {
            const head = String(rawText).slice(0, 120);
            if (/^action=/.test(String(rawText).trim())) {
                throw new Error(
                    'Server returned form data as the response body (not JSON). ' +
                    'Fix Code.gs: getUserRecords / doPost must return jsonResponse({...}), ' +
                    'never return e.postData.contents or the raw request string.'
                );
            }
            throw new Error(`Invalid JSON (first 120 chars): ${head}`);
        }

        if (data.status === 'error') {
            throw new Error(data.message || 'Failed to get record data');
        }

        if (data.message === 'Data saved successfully' && !Array.isArray(data.records)) {
            throw new Error(
                'A szerver a mentési ágat futtatta (Data saved), nem a listázást. Code.gs: a doPost() ' +
                'elején ágazd el getUserRecords-ra (e.parameter.action / e.parameter.records vagy ' +
                'JSON: action / recordsQuery), majd Deploy → új verzió. Ellenőrizd, hogy a SCRIPT_URL ' +
                'ugyanahhoz a deploymenthez tartozik, amit szerkesztesz.'
            );
        }

        const { records, sourceKey } = extractRecordsArray(data);

        allUserRecords = records.map(normalizeRecord);
        renderRecords();
        setRecordsStatus(`Betöltve: ${allUserRecords.length} rekord`);
        setRecordsDebug({
            stage: 'fetchUserRecords:success',
            hint: 'If sourceKey is none but raw shows rows, adjust Apps Script JSON shape or column mapping.',
            emailCheck: {
                argumentUserEmail: userEmail,
                localStorageUserEmail: storedEmail,
                emailsMatch: !storedEmail || storedEmail === userEmail
            },
            requestNote: 'POST ?action=getUserRecords + JSON body (text/plain); token only in body',
            responseStatus: response.status,
            responseKeys: Object.keys(data || {}),
            recordsSourceKey: sourceKey,
            sourceArrayLength: records.length,
            normalizedLength: allUserRecords.length,
            firstRawRows: records.slice(0, 5),
            firstNormalizedRows: allUserRecords.slice(0, 5),
            rawResponsePreview: rawText.length > 2500 ? `${rawText.slice(0, 2500)}…` : rawText
        });
    } catch (error) {
        console.error('Error fetching user records:', error);
        allUserRecords = [];
        renderRecords();
        setRecordsStatus(`Hiba rekordok betöltésekor: ${error.message}`, true);
        setRecordsDebug({
            stage: 'fetchUserRecords:error',
            emailCheck: {
                argumentUserEmail: userEmail,
                localStorageUserEmail: storedEmail,
                emailsMatch: !storedEmail || storedEmail === userEmail
            },
            request: {
                action: 'getUserRecords',
                email: userEmail
            },
            errorMessage: error.message
        });
    } finally {
        setRecordsLoading(false);
    }
}


// For PWA support
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('Service Worker registered', reg))
        .catch(err => console.error('Service Worker registration failed', err));
}