#!/usr/bin/env node

/**
 * Load Testing Script for Video Transcoding Service
 * 
 * This script creates multiple transcoding jobs simultaneously to generate CPU load.
 * Required for CAB432 Assignment 1 to demonstrate >80% CPU usage for 5+ minutes.
 */

const BASE_URL = 'http://localhost:3000';
let authToken = null;

// Test configuration for CPU load generation
const TEST_CONFIG = {
  concurrent_jobs: 3,      // Number of simultaneous transcoding jobs
  target_resolution: '640x360',  // Lower resolution for faster processing
  target_format: 'mp4',
  quality_preset: 'medium',
  bitrate: '1000k',
  username: 'user1',
  password: 'password'
};

async function makeRequest(url, options = {}) {
  const fetch = (await import('node-fetch')).default;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` })
    }
  };
  
  const response = await fetch(url, { ...defaultOptions, ...options });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }
  
  return response.json();
}

async function login() {
  console.log('Logging in...');
  
  const response = await makeRequest(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      username: TEST_CONFIG.username,
      password: TEST_CONFIG.password
    })
  });
  
  authToken = response.token;
  console.log(`Logged in as ${TEST_CONFIG.username}`);
}

async function getAvailableVideos() {
  console.log('Fetching available videos...');
  
  const videos = await makeRequest(`${BASE_URL}/videos`);
  
  if (videos.length === 0) {
    console.log('No videos found! Please upload some videos first using the web interface.');
    console.log(`   Visit: ${BASE_URL}`);
    process.exit(1);
  }
  
  console.log(`Found ${videos.length} videos:`);
  videos.forEach((video, index) => {
    console.log(`   ${index + 1}. ${video.filename} (${video.size_mb.toFixed(1)}MB)`);
  });
  
  return videos;
}

async function createTranscodingJob(videoId, videoName) {
  console.log(`Creating transcoding job for ${videoName}...`);
  
  const job = await makeRequest(`${BASE_URL}/transcode/jobs`, {
    method: 'POST',
    body: JSON.stringify({
      video_id: videoId,
      target_resolution: TEST_CONFIG.target_resolution,
      target_format: TEST_CONFIG.target_format,
      quality_preset: TEST_CONFIG.quality_preset,
      bitrate: TEST_CONFIG.bitrate
    })
  });
  
  console.log(`Job created: ${job.job.id}`);
  return job.job;
}

async function startTranscodingJob(jobId) {
  console.log(`Starting CPU-intensive transcoding for job ${jobId}...`);
  
  const result = await makeRequest(`${BASE_URL}/transcode/start/${jobId}`, {
    method: 'POST'
  });
  
  console.log(`Transcoding started: ${result.message}`);
}

async function monitorJobs() {
  console.log('\nMonitoring transcoding jobs...');
  console.log('Check your CPU usage with: top, htop, or docker stats');
  console.log('You should see CPU usage spike to 80-90%+');
  
  let completedJobs = 0;
  let totalJobs = TEST_CONFIG.concurrent_jobs;
  
  while (completedJobs < totalJobs) {
    const jobs = await makeRequest(`${BASE_URL}/transcode/jobs`);
    const activeJobs = jobs.filter(job => job.status === 'processing');
    const justCompleted = jobs.filter(job => job.status === 'completed');
    const failed = jobs.filter(job => job.status === 'failed');
    
    completedJobs = justCompleted.length;
    
    console.log(`\nStatus Update:`);
    console.log(`   Processing: ${activeJobs.length} jobs`);
    console.log(`   Completed: ${completedJobs} jobs`);
    console.log(`   Failed: ${failed.length} jobs`);
    
    if (activeJobs.length > 0) {
      console.log(`   CPU should be under high load right now!`);
    }
    
    if (completedJobs < totalJobs && failed.length < totalJobs) {
      console.log(`   ⏳ Waiting 10 seconds before next check...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    } else {
      break;
    }
  }
  
  console.log('\nLoad testing completed!');
  console.log(`Results: ${completedJobs} successful, ${totalJobs - completedJobs} failed`);
}

async function runLoadTest() {
  try {
    console.log('Video Transcoding Service - Load Testing');
    console.log('==========================================');
    console.log(`Target: ${BASE_URL}`);
    console.log(`Concurrent Jobs: ${TEST_CONFIG.concurrent_jobs}`);
    console.log(`Resolution: ${TEST_CONFIG.target_resolution}`);
    console.log(`Quality: ${TEST_CONFIG.quality_preset}`);
    console.log(`Bitrate: ${TEST_CONFIG.bitrate}\n`);
    
    // Step 1: Login
    await login();
    
    // Step 2: Get available videos
    const videos = await getAvailableVideos();
    
    // Step 3: Create multiple transcoding jobs
    const jobs = [];
    for (let i = 0; i < TEST_CONFIG.concurrent_jobs && i < videos.length; i++) {
      const video = videos[i % videos.length]; // Cycle through videos if needed
      const job = await createTranscodingJob(video.id, video.filename);
      jobs.push(job);
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\nStarting ${jobs.length} transcoding jobs simultaneously...`);
    console.log('   This will generate high CPU load!');
    
    // Step 4: Start all jobs simultaneously
    const startPromises = jobs.map(job => startTranscodingJob(job.id));
    await Promise.all(startPromises);
    
    console.log('\nALL JOBS STARTED - CPU LOAD SHOULD BE HIGH NOW!');
    console.log('Monitor CPU usage with: htop, top, or docker stats');
    
    // Step 5: Monitor progress
    await monitorJobs();
    
  } catch (error) {
    console.error('Load testing failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('Make sure the server is running on port 3000');
    }
    
    process.exit(1);
  }
}

// Run the load test
runLoadTest();