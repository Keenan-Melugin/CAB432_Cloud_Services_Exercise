// Global variables
let authToken = localStorage.getItem('authToken');
let currentUser = null;
let eventSource = null;

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

// Show email confirmation form
function showEmailConfirmation(email) {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('confirmationSection').classList.remove('hidden');
    document.getElementById('confirmationEmail').textContent = email;
}

// Handle email confirmation
async function confirmEmail() {
    const email = document.getElementById('confirmationEmail').textContent;
    const confirmationCode = document.getElementById('confirmationCode').value;

    if (!confirmationCode || confirmationCode.length !== 6) {
        showStatus('confirmationStatus', 'Please enter the 6-digit verification code', 'error');
        return;
    }

    try {
        const response = await fetch('/auth/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, confirmationCode })
        });

        const data = await response.json();

        if (response.ok) {
            showStatus('confirmationStatus', 'Email verified successfully! You can now log in.', 'success');

            // Clear the form and redirect to login after 2 seconds
            document.getElementById('confirmationCode').value = '';
            setTimeout(() => {
                showLogin();
                showStatus('loginStatus', 'Account verified! Please log in with your credentials.', 'success');
            }, 2000);
        } else {
            showStatus('confirmationStatus', data.error || 'Email verification failed', 'error');
        }
    } catch (error) {
        showStatus('confirmationStatus', 'Verification error: ' + error.message, 'error');
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

// Real-time job updates using Server-Sent Events
function startJobUpdates() {
    if (eventSource) {
        eventSource.close();
    }
    
    try {
        eventSource = new EventSource(`/transcode/events`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        // Note: EventSource doesn't support custom headers directly
        // We'll need to pass the token via URL parameter
        eventSource = new EventSource(`/transcode/events?token=${encodeURIComponent(authToken)}`);
        
        eventSource.onopen = function() {
        };
        
        eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'jobUpdate') {
                    // Handle real-time progress updates
                    if (data.data.status === 'processing' && data.data.progress) {
                        // Update progress bar in real-time without full refresh
                        updateJobProgress(data.data.id, data.data);
                    } else {
                        // For status changes (completed/failed), refresh the jobs list
                        refreshJobs();
                    }
                    
                    // Show notifications for job completion/failure
                    if (data.data.status === 'completed') {
                        showStatus('jobStatus', `Job ${data.data.id.substring(0, 8)} completed successfully!`, 'success');
                    } else if (data.data.status === 'failed') {
                        showStatus('jobStatus', `Job ${data.data.id.substring(0, 8)} failed: ${data.data.error_message}`, 'error');
                    }
                }
            } catch (error) {
                console.error('Error parsing SSE data:', error);
            }
        };
        
        eventSource.onerror = function(error) {
        };
        
    } catch (error) {
        console.error('Error starting SSE connection:', error);
    }
}

function stopJobUpdates() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
}

// Video upload functions
function uploadVideo() {
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
    
    const formData = new FormData();
    formData.append('video', file);
    
    showStatus('uploadStatus', 'Uploading video...', 'info');
    
    // Use XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    xhr.upload.addEventListener('progress', function(e) {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percentComplete + '%';
            progressText.textContent = percentComplete + '%';
            
            // Show file size info
            const uploadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
            const totalMB = (e.total / (1024 * 1024)).toFixed(1);
            showStatus('uploadStatus', `Uploading... ${uploadedMB}MB / ${totalMB}MB (${percentComplete}%)`, 'info');
        }
    });
    
    // Handle upload completion
    xhr.addEventListener('load', function() {
        // Hide progress bar and re-enable button
        progressContainer.style.display = 'none';
        uploadButton.disabled = false;
        uploadButton.textContent = 'Upload Video';
        
        if (xhr.status === 200) {
            try {
                const data = JSON.parse(xhr.responseText);
                showStatus('uploadStatus', 'Video uploaded successfully!', 'success');
                loadVideos(); // Refresh video list
                fileInput.value = ''; // Clear file input
            } catch (error) {
                showStatus('uploadStatus', 'Upload completed but response parsing failed', 'error');
            }
        } else {
            try {
                const data = JSON.parse(xhr.responseText);
                showStatus('uploadStatus', data.error || 'Upload failed', 'error');
            } catch (error) {
                showStatus('uploadStatus', `Upload failed: ${xhr.status} ${xhr.statusText}`, 'error');
            }
        }
    });
    
    // Handle upload errors
    xhr.addEventListener('error', function() {
        progressContainer.style.display = 'none';
        uploadButton.disabled = false;
        uploadButton.textContent = 'Upload Video';
        showStatus('uploadStatus', 'Upload error: Network error occurred', 'error');
    });
    
    // Handle upload abort
    xhr.addEventListener('abort', function() {
        progressContainer.style.display = 'none';
        uploadButton.disabled = false;
        uploadButton.textContent = 'Upload Video';
        showStatus('uploadStatus', 'Upload cancelled', 'info');
    });
    
    // Set up request
    xhr.open('POST', '/videos/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    
    // Start upload
    xhr.send(formData);
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
    
    jobs.forEach(job => {
        const jobDiv = document.createElement('div');
        jobDiv.className = 'job-item';
        
        const statusColor = job.status === 'completed' ? '#28a745' :
                           job.status === 'processing' ? '#ffc107' :
                           job.status === 'failed' ? '#dc3545' : '#6c757d';
        
        const progressHtml = job.status === 'processing' ? `
            <div class="progress-container">
                <div class="progress-bar" style="width: 0%"></div>
                <div class="progress-text">Initializing...</div>
            </div>
            <div class="progress-details" id="progress-details-${job.id}">Starting transcoding process...</div>
        ` : '';

        const repeatInfo = job.repeat_count > 1 ? `<br><strong>Repeat Count:</strong> ${job.repeat_count}x (concatenated into single video)` : '';
        
        jobDiv.innerHTML = `
            <strong>Job ${job.id.substring(0, 8)}</strong><br>
            <strong>Video:</strong> ${job.original_filename}<br>
            <strong>Target:</strong> ${job.target_resolution} ${job.target_format.toUpperCase()}<br>
            <strong>Quality:</strong> ${job.quality_preset || 'medium'} @ ${job.bitrate || '1000k'}${repeatInfo}<br>
            <strong>Status:</strong> <span style="color: ${statusColor}">${job.status.toUpperCase()}</span><br>
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
            ${job.status === 'completed' && job.output_path ? 
                `<br><button onclick="downloadVideo('${job.id}', '${job.original_filename}')">Download Result</button>
` : ''
            }
        `;
        
        // Store the job div reference for progress updates
        jobDiv.setAttribute('data-job-id', job.id);
        
        container.appendChild(jobDiv);
    });
}

// Update progress bar for a specific job
function updateJobProgress(jobId, progressData) {
    const jobDiv = document.querySelector(`[data-job-id="${jobId}"]`);
    if (!jobDiv) return;
    
    const progressBar = jobDiv.querySelector('.progress-bar');
    const progressText = jobDiv.querySelector('.progress-text');
    const progressDetails = jobDiv.querySelector(`#progress-details-${jobId}`);
    
    if (progressBar && progressText && progressData.progress) {
        const percent = progressData.progress.percent || 0;
        const timemark = progressData.progress.timemark || '00:00:00';
        const fps = progressData.progress.fps || 0;
        const kbps = progressData.progress.currentKbps || 0;
        
        // Update progress bar
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${percent}%`;
        
        // Update progress details
        if (progressDetails) {
            progressDetails.innerHTML = `
                ${percent}% complete • ${timemark} • ${fps} fps • ${kbps} kb/s
            `;
        }
        
        // Add visual feedback for completion
        if (percent >= 100) {
            progressBar.style.background = 'linear-gradient(90deg, #28a745, #20c997)';
            progressText.textContent = 'Finishing up...';
        }
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