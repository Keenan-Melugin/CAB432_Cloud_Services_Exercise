// Global variables
let authToken = localStorage.getItem('authToken');
let currentUser = null;
let eventSource = null;
let pollingInterval = null;

// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', function() {
    if (authToken) {
        // Try to restore user info from localStorage or fetch from server
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
        }
        showMainApp();
        loadVideos();
        loadOriginalVideos();
        refreshJobs();
    }
});

// Authentication functions
// Google OAuth login
function loginWithGoogle() {
    // Redirect to Google OAuth endpoint
    window.location.href = '/auth/google';
}

// Show/Hide authentication forms
function showLogin() {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('signupSection').classList.add('hidden');
}

function showSignup() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('signupSection').classList.remove('hidden');
}

async function login() {
    const email = document.getElementById('username').value; // Input field is called username but contains email
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showStatus('loginStatus', 'Please enter email and password', 'error');
        return;
    }

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Handle both regular login and MFA challenge responses
            if (data.requiresMFA) {
                // MFA challenge required - handle this separately
                handleMFAChallenge(data);
                return;
            }

            authToken = data.accessToken; // Use accessToken instead of token
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showMainApp();
            loadVideos();
            refreshJobs();
            showStatus('loginStatus', 'Login successful!', 'success');
        } else {
            showStatus('loginStatus', data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showStatus('loginStatus', 'Login error: ' + error.message, 'error');
    }
}

// User registration function
async function signup() {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Basic validation
    if (!email || !password || !confirmPassword) {
        showStatus('signupStatus', 'Please fill in all fields', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showStatus('signupStatus', 'Passwords do not match', 'error');
        return;
    }

    // Validate password against Cognito requirements
    if (password.length < 8) {
        showStatus('signupStatus', 'Password must be at least 8 characters', 'error');
        return;
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
        showStatus('signupStatus', 'Password must contain: uppercase letter, lowercase letter, number, and special character (!@#$%^&*)', 'error');
        return;
    }

    try {
        const response = await fetch('/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            showStatus('signupStatus', 'Account created successfully! Please check your email for a verification code.', 'success');
            // Clear form
            document.getElementById('signupEmail').value = '';
            document.getElementById('signupPassword').value = '';
            document.getElementById('confirmPassword').value = '';

            // Show email confirmation section after 2 seconds
            setTimeout(() => {
                showEmailConfirmation(email);
            }, 2000);
        } else {
            showStatus('signupStatus', data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showStatus('signupStatus', 'Registration error: ' + error.message, 'error');
    }
}

// Show email confirmation modal
function showEmailConfirmation(email) {
    document.getElementById('confirmationEmail').textContent = email;
    document.getElementById('verificationModal').style.display = 'block';
    document.getElementById('confirmationCode').value = '';
    document.getElementById('confirmationCode').focus();
    clearStatus('confirmationStatus');
}

// Close verification modal
function closeVerificationModal() {
    document.getElementById('verificationModal').style.display = 'none';
    clearStatus('confirmationStatus');
}

// Handle input formatting and Enter key
function formatVerificationCode(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
}

function handleVerificationKeypress(event) {
    if (event.key === 'Enter') {
        confirmEmail();
    }
}

// Handle email confirmation
async function confirmEmail() {
    const email = document.getElementById('confirmationEmail').textContent;
    const confirmationCode = document.getElementById('confirmationCode').value;

    console.log('Confirming email:', email, 'with code:', confirmationCode);

    if (!confirmationCode || confirmationCode.length !== 6) {
        showStatus('confirmationStatus', 'Please enter the 6-digit verification code', 'error');
        return;
    }

    // Show loading state
    const button = document.querySelector('#verificationModal button');
    if (!button) {
        console.error('Verification button not found!');
        return;
    }

    const originalText = button.textContent;
    button.textContent = '⏳ Verifying...';
    button.disabled = true;

    console.log('Starting verification request...');

    try {
        const response = await fetch('/auth/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, confirmationCode })
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (response.ok) {
            showStatus('confirmationStatus', '✅ Email verified successfully! Redirecting to login...', 'success');

            // Close modal and redirect to login after 1.5 seconds
            setTimeout(() => {
                closeVerificationModal();
                showLogin();
                showStatus('loginStatus', '🎉 Account verified! Please log in with your credentials.', 'success');
            }, 1500);
        } else {
            console.log('Verification failed with error:', data.error);
            showStatus('confirmationStatus', '❌ ' + (data.error || 'Email verification failed'), 'error');
            // Reset button
            button.textContent = originalText;
            button.disabled = false;
        }
    } catch (error) {
        console.error('Verification request failed:', error);
        showStatus('confirmationStatus', '❌ Verification error: ' + error.message, 'error');
        // Reset button
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Resend confirmation code (placeholder for future implementation)
function resendConfirmationCode() {
    const email = document.getElementById('confirmationEmail').textContent;
    showStatus('confirmationStatus', 'Resend functionality not implemented yet. Please use the existing code: ' + email, 'info');
    // TODO: Implement resend confirmation code endpoint
}

// Handle MFA challenge (placeholder for future MFA UI implementation)
function handleMFAChallenge(data) {
    console.log('MFA Challenge required:', data);
    showStatus('loginStatus', 'MFA challenge required. Please use the /auth/mfa endpoints to complete authentication.', 'info');
    // TODO: Implement MFA UI flow when adding MFA setup UI
}

function logout() {
    stopJobUpdates(); // Close SSE connection
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('mainApp').classList.add('hidden');
    showStatus('loginStatus', 'Logged out successfully', 'info');
}

function showMainApp() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('mainApp').classList.remove('hidden');
    
    // Update user welcome section
    if (currentUser) {
        document.getElementById('currentUsername').textContent = currentUser.username;
        const roleElement = document.getElementById('userRole');
        roleElement.textContent = currentUser.role;
        roleElement.className = `user-role ${currentUser.role}`;
    }
    
    // Show admin section for admin users
    if (currentUser && currentUser.role === 'admin') {
        document.getElementById('adminSection').style.display = 'block';
    }
    
    // Start real-time job updates
    startJobUpdates();
}

// Real-time job updates with reliable polling
function startJobUpdates() {
    console.log('🚀 Starting job update system');
    startProgressTracking();

    // Start slower background refresh for job list (every 10 seconds)
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    pollingInterval = setInterval(() => {
        // Only refresh if no active jobs (to avoid conflicts)
        if (activeJobs.size === 0) {
            console.log('📋 Background job list refresh (no active jobs)');
            refreshJobs();
        }
    }, 10000);
}

// Attempt SSE connection
// Track active jobs for progress updates
const activeJobs = new Set();

// Use separate intervals to avoid conflicts
let progressInterval = null;

function startProgressTracking() {
    console.log('🔄 Starting reliable polling-based progress tracking');

    // Poll for progress every 2 seconds
    if (progressInterval) {
        clearInterval(progressInterval);
    }

    progressInterval = setInterval(async () => {
        if (activeJobs.size > 0) {
            console.log(`📊 Polling progress for ${activeJobs.size} active jobs`);

            for (const jobId of activeJobs) {
                await checkJobProgress(jobId);
            }
        }
    }, 2000);
}

async function checkJobProgress(jobId) {
    try {
        const response = await fetch(`/transcode/progress/${jobId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`📈 Progress for ${jobId}: ${data.progress}% (${data.status})`);

            // Update progress bar
            updateJobProgressBar(jobId, data.progress, data);

            // Handle completion/failure
            if (data.status === 'completed') {
                activeJobs.delete(jobId);
                showStatus('jobStatus', 'Job completed successfully!', 'success');
                setTimeout(() => refreshJobs(), 1000);
            } else if (data.status === 'failed') {
                activeJobs.delete(jobId);
                showStatus('jobStatus', `Job failed: ${data.error || 'Unknown error'}`, 'error');
                setTimeout(() => refreshJobs(), 1000);
            }
        }
    } catch (error) {
        console.error(`❌ Error checking progress for ${jobId}:`, error);
    }
}

function stopJobUpdates() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    activeJobs.clear();
    console.log('🛑 All job updates stopped');
}

function updateJobProgress(jobId, jobData) {
    const jobElement = document.querySelector(`[data-job-id="${jobId}"]`);
    if (!jobElement) {
        console.log('Job element not found for ID:', jobId);
        return;
    }

    // Update progress bar
    const progressBar = jobElement.querySelector('.progress-bar');
    const progressText = jobElement.querySelector('.progress-text');
    const progressDetails = jobElement.querySelector('.progress-details');

    if (progressBar && jobData.progress) {
        progressBar.style.width = jobData.progress + '%';
    }

    if (progressText && jobData.progress) {
        progressText.textContent = jobData.progress + '%';
    }

    if (progressDetails && jobData.processing_details) {
        progressDetails.textContent = `${jobData.processing_details.current_time || ''} | ${jobData.processing_details.bitrate || ''} | ${jobData.processing_details.speed || ''}`;
    }

    // Update status
    if (jobData.status) {
        const statusElement = jobElement.querySelector('.job-status');
        if (statusElement) {
            statusElement.textContent = jobData.status;
            statusElement.className = `job-status ${jobData.status}`;
        }
    }
}

// Video upload functions
async function uploadVideo() {
    const fileInput = document.getElementById('videoFile');
    const file = fileInput.files[0];
    const uploadButton = document.getElementById('uploadButton');
    const progressContainer = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');

    if (!file) {
        showStatus('uploadStatus', 'Please select a video file', 'error');
        return;
    }

    if (!file.type.startsWith('video/')) {
        showStatus('uploadStatus', 'Please select a valid video file', 'error');
        return;
    }

    // Show progress bar and disable upload button
    progressContainer.style.display = 'block';
    uploadButton.disabled = true;
    uploadButton.textContent = 'Uploading...';

    // Reset progress bar
    progressBar.style.width = '0%';
    progressText.textContent = '0%';

    try {
        showStatus('uploadStatus', 'Preparing upload...', 'info');

        // First, try to get a presigned upload URL for direct S3 upload
        const presignedResponse = await fetch('/videos/presigned-upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName: file.name,
                fileSize: file.size,
                contentType: file.type
            })
        });

        if (presignedResponse.ok) {
            // Use direct S3 upload
            const presignedData = await presignedResponse.json();
            console.log('Presigned data received:', {
                uploadUrl: presignedData.uploadUrl,
                key: presignedData.key,
                fieldsCount: Object.keys(presignedData.fields).length
            });
            await uploadDirectToS3(file, presignedData, progressBar, progressText);
        } else if (presignedResponse.status === 500 || presignedResponse.status === 404) {
            // Fallback to traditional upload through API Gateway
            console.log('Direct S3 upload not available, falling back to traditional upload');
            showStatus('uploadStatus', 'Using traditional upload method...', 'info');
            await uploadThroughAPI(file, progressBar, progressText);
        } else {
            throw new Error(`Failed to prepare upload: ${presignedResponse.status}`);
        }

        showStatus('uploadStatus', 'Video uploaded successfully!', 'success');
        loadVideos(); // Refresh video list for transcoding dropdown
        loadOriginalVideos(); // Refresh original videos list
        fileInput.value = ''; // Clear file input

    } catch (error) {
        console.error('Upload error:', error);
        showStatus('uploadStatus', `Upload failed: ${error.message}`, 'error');
    } finally {
        // Hide progress bar and re-enable button
        progressContainer.style.display = 'none';
        uploadButton.disabled = false;
        uploadButton.textContent = 'Upload Video';
    }
}

async function uploadDirectToS3(file, presignedData, progressBar, progressText) {
    // Create FormData for S3 upload
    const formData = new FormData();
    Object.entries(presignedData.fields).forEach(([key, value]) => {
        formData.append(key, value);
    });
    formData.append('file', file);

    // Upload directly to S3
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percentComplete + '%';
                progressText.textContent = percentComplete + '%';

                const uploadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
                const totalMB = (e.total / (1024 * 1024)).toFixed(1);
                showStatus('uploadStatus', `Uploading to S3... ${uploadedMB}MB / ${totalMB}MB (${percentComplete}%)`, 'info');
            }
        });

        xhr.addEventListener('load', async function() {
            console.log('S3 upload completed with status:', xhr.status);
            console.log('S3 upload response:', xhr.responseText);

            if (xhr.status === 204) {
                // S3 upload successful, now confirm with our API
                showStatus('uploadStatus', 'Confirming upload...', 'info');

                try {
                    const confirmResponse = await fetch('/videos/confirm-upload', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            key: presignedData.key,
                            originalName: file.name,
                            fileSize: file.size,
                            contentType: file.type
                        })
                    });

                    if (confirmResponse.ok) {
                        resolve();
                    } else {
                        const errorData = await confirmResponse.json();
                        reject(new Error(errorData.error || 'Failed to confirm upload'));
                    }
                } catch (error) {
                    reject(new Error('Failed to confirm upload: ' + error.message));
                }
            } else {
                console.error('S3 upload failed with unexpected status:', xhr.status);
                console.error('Response headers:', xhr.getAllResponseHeaders());
                reject(new Error(`S3 upload failed: ${xhr.status} ${xhr.statusText}`));
            }
        });

        xhr.addEventListener('error', function(e) {
            console.error('XHR error event:', e);
            console.error('Upload URL was:', presignedData.uploadUrl);
            reject(new Error('Network error during S3 upload'));
        });

        console.log('Starting S3 upload to:', presignedData.uploadUrl);
        xhr.open('POST', presignedData.uploadUrl);
        xhr.send(formData);
    });
}

async function uploadThroughAPI(file, progressBar, progressText) {
    const formData = new FormData();
    formData.append('video', file);

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percentComplete + '%';
                progressText.textContent = percentComplete + '%';

                const uploadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
                const totalMB = (e.total / (1024 * 1024)).toFixed(1);
                showStatus('uploadStatus', `Uploading... ${uploadedMB}MB / ${totalMB}MB (${percentComplete}%)`, 'info');
            }
        });

        xhr.addEventListener('load', function() {
            if (xhr.status === 200) {
                resolve();
            } else {
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    reject(new Error(errorData.error || `Upload failed: ${xhr.status}`));
                } catch (error) {
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                }
            }
        });

        xhr.addEventListener('error', function() {
            reject(new Error('Network error during upload'));
        });

        xhr.open('POST', '/videos/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
        xhr.send(formData);
    });
}

// Load available videos for transcoding
async function loadVideos() {
    try {
        const response = await fetch('/videos', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const videos = await response.json();
        const select = document.getElementById('videoSelect');
        select.innerHTML = '<option value="">Select a video...</option>';
        
        videos.forEach(video => {
            const option = document.createElement('option');
            option.value = video.id;
            option.textContent = `${video.filename} (${Math.round(video.size_mb)}MB)`;
            select.appendChild(option);
        });

        // Also display videos with download links
        displayVideoList(videos);
    } catch (error) {
        console.error('Error loading videos:', error);
    }
}

// Transcoding job functions
async function createTranscodeJob() {
    const videoId = document.getElementById('videoSelect').value;
    const resolution = document.getElementById('resolution').value;
    const format = document.getElementById('format').value;
    const qualityPreset = document.getElementById('qualityPreset').value;
    const bitrate = document.getElementById('bitrate').value;
    const repeatCount = document.getElementById('repeatCount').value;
    
    if (!videoId) {
        showStatus('jobStatus', 'Please select a video', 'error');
        return;
    }
    
    // Validate repeat count
    const repeatCountNum = parseInt(repeatCount);
    if (isNaN(repeatCountNum) || repeatCountNum < 1) {
        showStatus('jobStatus', 'Repeat count must be 1 or greater', 'error');
        return;
    }
    
    // Resource usage warnings
    const isHighRes = ['3840x2160', '2560x1440', '1920x1080'].includes(resolution);
    const isSlowPreset = ['slow', 'veryslow'].includes(qualityPreset);
    const isHighBitrate = ['4000k', '8000k'].includes(bitrate);
    
    if (isHighRes && isSlowPreset && isHighBitrate) {
        const proceed = confirm('Warning: This combination (4K/1080p + slow/veryslow + high bitrate) requires significant resources and may take a very long time or fail on large files. Continue?');
        if (!proceed) return;
    }
    
    // Show user-friendly message with selected options
    const options = `${resolution} @ ${bitrate} (${qualityPreset} quality, ${repeatCount}x repeat)`;
    showStatus('jobStatus', `Creating transcoding job: ${options}...`, 'info');
    
    try {
        const response = await fetch('/transcode/jobs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                video_id: videoId,
                target_resolution: resolution,
                target_format: format,
                quality_preset: qualityPreset,
                bitrate: bitrate,
                repeat_count: parseInt(repeatCount)
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatus('jobStatus', `Job created! Click "Start Processing" to begin transcoding.`, 'success');
            refreshJobs();
        } else {
            showStatus('jobStatus', data.error || 'Failed to create job', 'error');
        }
    } catch (error) {
        showStatus('jobStatus', 'Error: ' + error.message, 'error');
    }
}

async function startTranscoding(jobId) {
    try {
        const response = await fetch(`/transcode/start/${jobId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatus('jobStatus', 'Transcoding started successfully!', 'success');

            // Add job to tracking and start polling
            activeJobs.add(jobId);
            console.log(`📋 Added job ${jobId} to active tracking`);

            refreshJobs();
        } else {
            alert('Error starting transcoding: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function refreshJobs() {
    try {
        const response = await fetch('/transcode/jobs', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const jobs = await response.json();
        displayJobs(jobs);
    } catch (error) {
        console.error('Error loading jobs:', error);
    }
}

function displayJobs(jobs) {
    const container = document.getElementById('jobsList');
    container.innerHTML = '';
    
    if (jobs.length === 0) {
        container.innerHTML = '<p>No transcoding jobs yet.</p>';
        return;
    }

    // Sort jobs by creation date (newest first)
    const sortedJobs = jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    sortedJobs.forEach(job => {
        const jobDiv = document.createElement('div');
        jobDiv.className = 'job-item';
        jobDiv.setAttribute('data-job-id', job.id);

        const statusColor = job.status === 'completed' ? '#28a745' :
                           job.status === 'processing' ? '#ffc107' :
                           job.status === 'failed' ? '#dc3545' : '#6c757d';

        // Set card background colors based on status
        const backgroundColor = job.status === 'completed' ? '#d4edda' :    // Light green
                               job.status === 'processing' ? '#fff3cd' :     // Light yellow
                               job.status === 'failed' ? '#f8d7da' :         // Light red
                               '#f8f9fa';                                     // Light gray (pending)

        jobDiv.style.backgroundColor = backgroundColor;
        jobDiv.style.border = `2px solid ${statusColor}`;
        jobDiv.style.borderRadius = '8px';
        
        // Only show progress bar when job is actually processing (not pending)
        const progressHtml = job.status === 'processing' ? `
            <div class="progress-container">
                <div class="progress-bar" style="width: ${job.progress || 0}%"></div>
                <div class="progress-text">${job.progress ? job.progress + '%' : 'Initializing...'}</div>
            </div>
            <div class="progress-details" id="progress-details-${job.id}">
                ${job.processing_details ?
                    `${job.processing_details.current_time || ''} | ${job.processing_details.bitrate || ''} | ${job.processing_details.speed || ''}` :
                    'Starting transcoding process...'
                }
            </div>
        ` : '';

        const repeatInfo = job.repeat_count > 1 ? `<br><strong>Repeat Count:</strong> ${job.repeat_count}x (concatenated into single video)` : '';
        
        jobDiv.innerHTML = `
            <strong>Job ${job.id.substring(0, 8)}</strong><br>
            <strong>Video:</strong> ${job.original_filename}<br>
            <strong>Target:</strong> ${job.target_resolution} ${job.target_format.toUpperCase()}<br>
            <strong>Quality:</strong> ${job.quality_preset || 'medium'} @ ${job.bitrate || '1000k'}${repeatInfo}<br>
            <strong>Status:</strong> <span class="job-status ${job.status}" style="color: ${statusColor}">${job.status.toUpperCase()}</span><br>
            <strong>Created:</strong> ${new Date(job.created_at + ' UTC').toLocaleString('en-AU', { 
                timeZone: 'Australia/Brisbane',
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: false 
            })}<br>
            ${job.processing_time_seconds ? `<strong>Processing Time:</strong> ${job.processing_time_seconds}s<br>` : ''}
            ${progressHtml}
            ${job.status === 'pending' ? `<button onclick="startTranscoding('${job.id}')">Start Processing</button>` : ''}
            ${job.status === 'completed' ?
                `<br><button onclick="downloadVideo('${job.id}', '${job.original_filename}')">Download Result</button>` : ''
            }
        `;
        
        // Store the job div reference for progress updates
        jobDiv.setAttribute('data-job-id', job.id);
        
        container.appendChild(jobDiv);
    });
}

// Download transcoded video
async function downloadVideo(jobId, originalFilename) {
    try {
        const response = await fetch(`/transcode/download/${jobId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();

            // Create a temporary download link
            const downloadLink = document.createElement('a');
            downloadLink.href = data.downloadUrl;
            downloadLink.download = data.filename || `transcoded_${originalFilename}`;
            downloadLink.style.display = 'none';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            showStatus('jobStatus', 'Download started!', 'success');
        } else {
            const errorData = await response.json();
            showStatus('jobStatus', errorData.error || 'Download failed', 'error');
        }
    } catch (error) {
        console.error('Download error:', error);
        showStatus('jobStatus', 'Download failed: ' + error.message, 'error');
    }
}

// Simple progress bar update function
function updateJobProgressBar(jobId, percent, data = {}) {
    console.log(`🎯 Updating progress bar: ${jobId} -> ${percent}%`);

    const jobDiv = document.querySelector(`[data-job-id="${jobId}"]`);
    if (!jobDiv) {
        console.log('❌ Job div not found:', jobId);
        return;
    }

    const progressBar = jobDiv.querySelector('.progress-bar');
    const progressText = jobDiv.querySelector('.progress-text');

    if (progressBar && progressText) {
        // Update progress bar
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${percent}%`;

        // Update details if available
        const progressDetails = jobDiv.querySelector(`#progress-details-${jobId}`);
        if (progressDetails) {
            let details = `${percent}% complete`;
            if (data.timemark) details += ` • ${data.timemark}`;
            if (data.fps) details += ` • ${data.fps} fps`;
            if (data.kbps) details += ` • ${data.kbps} kb/s`;
            if (data.message) details += ` • ${data.message}`;

            progressDetails.innerHTML = details;
        }

        // Visual feedback for completion
        if (percent >= 100) {
            progressBar.style.background = 'linear-gradient(90deg, #28a745, #20c997)';
            progressText.textContent = 'Complete!';
        }

        console.log(`✅ Progress updated: ${percent}%`);
    } else {
        console.log('❌ Progress elements not found for job:', jobId);
    }
}

// System stats (admin only)
async function getSystemStats() {
    try {
        const response = await fetch('/transcode/stats', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const stats = await response.json();
        document.getElementById('systemStats').innerHTML = `
            <div class="status info">
                <strong>System Statistics:</strong><br>
                Total Jobs: ${stats.totalJobs}<br>
                Active Jobs: ${stats.activeJobs}<br>
                Completed Jobs: ${stats.completedJobs}<br>
                Failed Jobs: ${stats.failedJobs}<br>
                Disk Usage: ${stats.diskUsage}
            </div>
        `;
    } catch (error) {
        document.getElementById('systemStats').innerHTML = 
            `<div class="status error">Error loading stats: ${error.message}</div>`;
    }
}

// Original Videos functionality
async function loadOriginalVideos() {
    try {
        console.log('🎬 Loading original videos...');
        const response = await fetch('/videos', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const videos = await response.json();
            displayOriginalVideos(videos);
        } else {
            document.getElementById('originalVideosList').innerHTML =
                '<p style="color: #dc3545;">Failed to load videos. Please try again.</p>';
        }
    } catch (error) {
        console.error('Error loading original videos:', error);
        document.getElementById('originalVideosList').innerHTML =
            '<p style="color: #dc3545;">Error loading videos: ' + error.message + '</p>';
    }
}

function displayOriginalVideos(videos) {
    const container = document.getElementById('originalVideosList');

    if (videos.length === 0) {
        container.innerHTML = '<p>No videos uploaded yet. Upload a video above to get started.</p>';
        return;
    }

    // Sort by upload date (newest first)
    const sortedVideos = videos.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));

    container.innerHTML = sortedVideos.map(video => `
        <div class="video-item">
            <div class="video-info">
                <strong>${video.filename}</strong><br>
                <small>Size: ${video.size_mb}MB • Format: ${video.format.toUpperCase()} • Uploaded: ${new Date(video.uploaded).toLocaleDateString()}</small>
            </div>
            <div class="video-actions">
                <button onclick="streamVideo('${video.id}', '${video.filename}')" style="background-color: #28a745;">
                    🎬 Watch
                </button>
                <button onclick="downloadOriginalVideo('${video.id}', '${video.filename}')" style="background-color: #007bff;">
                    📥 Download
                </button>
            </div>
        </div>
    `).join('');
}

async function streamVideo(videoId, filename) {
    try {
        console.log('🎥 Starting video stream for:', filename);

        // Get streaming URL
        const response = await fetch(`/videos/${videoId}/stream`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();

            // Set up video player
            const modal = document.getElementById('videoModal');
            const player = document.getElementById('videoPlayer');
            const title = document.getElementById('videoTitle');
            const info = document.getElementById('videoInfo');

            title.textContent = filename;
            info.textContent = `Stream expires in ${Math.floor(data.expiresIn / 60)} minutes`;

            player.src = data.streamUrl;
            player.load();

            modal.style.display = 'flex';

            console.log('✅ Video stream ready');
        } else {
            const error = await response.text();
            alert('Failed to load video: ' + error);
        }
    } catch (error) {
        console.error('Error streaming video:', error);
        alert('Error loading video: ' + error.message);
    }
}

async function downloadOriginalVideo(videoId, filename) {
    try {
        console.log('📥 Starting download for:', filename);

        const response = await fetch(`/videos/${videoId}/download`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();

            // Create download link
            const a = document.createElement('a');
            a.href = data.downloadUrl;
            a.download = data.filename;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            console.log('✅ Download started');
        } else {
            const error = await response.text();
            alert('Download failed: ' + error);
        }
    } catch (error) {
        console.error('Error downloading video:', error);
        alert('Download error: ' + error.message);
    }
}

function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    const player = document.getElementById('videoPlayer');

    player.pause();
    player.src = '';
    modal.style.display = 'none';

    console.log('🔒 Video player closed');
}

// Close modal when clicking outside the content
document.getElementById('videoModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeVideoModal();
    }
});

// Download video with proper authentication
async function downloadVideo(jobId, originalFilename) {
    try {
        const response = await fetch(`/transcode/download/${jobId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            const error = await response.text();
            alert(`Download failed: ${error}`);
            return;
        }

        // Check if response is JSON (pre-signed URL) or blob (direct file)
        const contentType = response.headers.get('Content-Type');

        if (contentType && contentType.includes('application/json')) {
            // Handle S3 pre-signed URL response
            const data = await response.json();

            // Create download link using pre-signed URL
            const a = document.createElement('a');
            a.href = data.downloadUrl;
            a.download = data.filename;
            a.target = '_blank'; // Open in new tab for S3 downloads
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            console.log(`Download initiated via pre-signed URL (expires in ${data.expiresIn}s)`);

        } else {
            // Handle direct file download (fallback for local storage)
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            // Get filename from server response headers or construct it properly
            let filename = response.headers.get('Content-Disposition');
            if (filename) {
                filename = filename.split('filename=')[1].replace(/"/g, '');
            } else {
                filename = null;
            }

            const a = document.createElement('a');
            a.href = url;
            if (filename) {
                a.download = filename;
            }
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }

    } catch (error) {
        console.error('Download error:', error);
        alert('Download failed: ' + error.message);
    }
}




// Display video list with download options
function displayVideoList(videos) {
    // Create a simple video list in the upload section for download access
    const uploadSection = document.querySelector('.container:nth-child(3)');
    let videoListDiv = document.getElementById('videoListDisplay');

    if (!videoListDiv) {
        videoListDiv = document.createElement('div');
        videoListDiv.id = 'videoListDisplay';
        videoListDiv.innerHTML = '<h3>Uploaded Videos</h3>';
        uploadSection.appendChild(videoListDiv);
    }

    if (videos.length === 0) {
        videoListDiv.innerHTML = '<h3>Uploaded Videos</h3><p>No videos uploaded yet.</p>';
        return;
    }

    const videoItems = videos.map(video => `
        <div style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 4px;">
            <strong>${video.filename}</strong> (${Math.round(video.size_mb)}MB)<br>
            <small>Uploaded: ${new Date(video.uploaded + ' UTC').toLocaleString()}</small><br>
            <button onclick="downloadOriginalVideo('${video.id}', '${video.filename}')">Download Original</button>
        </div>
    `).join('');

    videoListDiv.innerHTML = `<h3>Uploaded Videos</h3>${videoItems}`;
}

// Download original video
async function downloadOriginalVideo(videoId, filename) {
    try {
        const response = await fetch(`/videos/${videoId}/download`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            const error = await response.text();
            alert(`Download failed: ${error}`);
            return;
        }

        // Check if response is JSON (pre-signed URL) or blob (direct file)
        const contentType = response.headers.get('Content-Type');

        if (contentType && contentType.includes('application/json')) {
            // Handle S3 pre-signed URL response
            const data = await response.json();

            // Create download link using pre-signed URL
            const a = document.createElement('a');
            a.href = data.downloadUrl;
            a.download = data.filename;
            a.target = '_blank'; // Open in new tab for S3 downloads
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            console.log(`Original video download initiated via pre-signed URL (expires in ${data.expiresIn}s)`);

        } else {
            // Handle direct file download (fallback for local storage)
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }

    } catch (error) {
        console.error('Original video download error:', error);
        alert('Download failed: ' + error.message);
    }
}

// Utility function to show status messages
function showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.innerHTML = `<div class="status ${type}">${message}</div>`;

    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            element.innerHTML = '';
        }, 3000);
    }
}

function clearStatus(elementId) {
    const element = document.getElementById(elementId);
    element.innerHTML = '';
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById('verificationModal');
    if (event.target === modal) {
        closeVerificationModal();
    }
}