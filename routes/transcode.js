const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const database = require('../utils/database-abstraction');
const { authenticateToken, requireAdmin, getUserIdAndRole } = require('../utils/auth');
const storage = require('../utils/storage');

const router = express.Router();

// Progress storage via database (stateless)
async function updateProgress(jobId, status, percent = 0, details = {}) {
  try {
    await database.updateTranscodeJob(jobId, {
      status: status,
      progress: percent,
      ...details
    });
    console.log(`📊 Progress stored: ${jobId} -> ${percent}% (${status})`);
  } catch (error) {
    console.error(`Failed to update progress for job ${jobId}:`, error);
  }
}

// Note: Progress cleanup handled by DynamoDB TTL or manual cleanup process

// POST /transcode/jobs - Create new transcoding job
router.post('/jobs', authenticateToken, async (req, res) => {
  try {
    const { 
      video_id, 
      target_resolution, 
      target_format, 
      quality_preset = 'medium',
      bitrate = '1000k',
      repeat_count = 1
    } = req.body;

    if (!video_id || !target_resolution || !target_format) {
      return res.status(400).json({ 
        error: 'video_id, target_resolution, and target_format are required' 
      });
    }

    // Validate quality preset
    const validPresets = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'];
    if (!validPresets.includes(quality_preset)) {
      return res.status(400).json({ 
        error: 'Invalid quality preset. Valid options: ' + validPresets.join(', ')
      });
    }

    // Validate bitrate
    const validBitrates = ['500k', '1000k', '2000k', '4000k', '8000k'];
    if (!validBitrates.includes(bitrate)) {
      return res.status(400).json({ 
        error: 'Invalid bitrate. Valid options: ' + validBitrates.join(', ')
      });
    }

    // Validate repeat count
    const repeatCountNum = parseInt(repeat_count);
    if (isNaN(repeatCountNum) || repeatCountNum < 1) {
      return res.status(400).json({ 
        error: 'Invalid repeat count. Must be 1 or greater.'
      });
    }

    // Verify video exists and user has access
    const video = await database.getVideoById(video_id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found or access denied' });
    }

    // Ensure Cognito user exists in database (for DynamoDB)
    if (req.user.isCognito) {
      await database.createOrGetCognitoUser(req.user);
    }

    // Check permissions - regular users can only transcode their own videos
    const { userId, userRole } = getUserIdAndRole(req.user);
    if (userRole !== 'admin' && video.user_id !== userId) {
      return res.status(404).json({ error: 'Video not found or access denied' });
    }

    // Create transcoding job
    const job = await database.createTranscodeJob({
      user_id: userId,
      video_id: video_id,
      original_filename: video.original_name,
      file_path: video.file_path,
      storage_key: video.storage_key,
      target_resolution: target_resolution,
      target_format: target_format,
      quality_preset: quality_preset,
      bitrate: bitrate,
      repeat_count: repeatCountNum
    });

    console.log(`Transcoding job created: ${job.id} by ${req.user.username}`);

    res.json({
      message: 'Transcoding job created successfully',
      job: {
        id: job.id,
        video_id,
        target_resolution,
        target_format,
        quality_preset,
        bitrate,
        repeat_count: repeatCountNum,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Error creating transcoding job:', error);
    res.status(500).json({ error: 'Failed to create transcoding job' });
  }
});

// POST /transcode/start/:jobId - Start CPU-intensive transcoding
router.post('/start/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;

    // Ensure Cognito user exists in database (for DynamoDB)
    if (req.user.isCognito) {
      await database.createOrGetCognitoUser(req.user);
    }

    // Get job details including storage keys
    const { userId, userRole } = getUserIdAndRole(req.user);
    const job = await database.getTranscodeJobWithVideo(jobId, userId, userRole);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    if (job.status !== 'pending') {
      return res.status(400).json({ error: 'Job is not in pending status' });
    }

    // Resource validation before processing
    try {
      // Check if input file exists and get its size
      const fs = require('fs');
      if (job.file_path && fs.existsSync(job.file_path)) {
        const stats = fs.statSync(job.file_path);
        const fileSizeGB = stats.size / (1024 * 1024 * 1024);
        
        // Warn for large files and high-resource combinations
        if (fileSizeGB > 1 && job.quality_preset === 'veryslow') {
          console.warn(`Warning: Large file (${fileSizeGB.toFixed(2)}GB) with veryslow preset - may cause memory issues`);
        }
        
        // Reject extremely large files to prevent system crashes
        if (fileSizeGB > 5) {
          return res.status(400).json({ 
            error: `File too large (${fileSizeGB.toFixed(2)}GB). Maximum supported: 5GB. Try using 'fast' or 'ultrafast' preset for large files.` 
          });
        }
      }
    } catch (error) {
      console.error('File validation error:', error.message);
    }

    // Update job status to processing
    await database.updateTranscodeJob(jobId, {
      status: 'processing',
      started_at: true
    });

    // Start transcoding asynchronously (this is the CPU-intensive part!)
    transcodeVideoAsync(job);

    res.json({
      message: 'Transcoding started successfully',
      job: {
        id: jobId,
        status: 'processing',
        message: 'Video transcoding in progress. This will consume high CPU resources.'
      }
    });

    console.log(`Started transcoding job: ${jobId}`);

  } catch (error) {
    console.error('Error starting transcoding:', error);
    res.status(500).json({ error: 'Failed to start transcoding' });
  }
});

// GET /transcode/jobs - List user's transcoding jobs
router.get('/jobs', authenticateToken, async (req, res) => {
  try {
    // Ensure Cognito user exists in database (for DynamoDB)
    if (req.user.isCognito) {
      await database.createOrGetCognitoUser(req.user);
    }

    // Use helper function for consistent user ID and role handling
    const { userId, userRole } = getUserIdAndRole(req.user);
    const jobs = await database.getTranscodeJobsByUser(userId, userRole);

    if (!Array.isArray(jobs)) {
      return res.json([]);
    }

    res.json(jobs);

  } catch (error) {
    console.error('Error fetching transcoding jobs:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch transcoding jobs', details: error.message });
  }
});

// GET /transcode/jobs/:jobId - Get specific job details
router.get('/jobs/:jobId', authenticateToken, async (req, res) => {
  try {
    // Ensure Cognito user exists in database (for DynamoDB)
    if (req.user.isCognito) {
      await database.createOrGetCognitoUser(req.user);
    }

    const job = await database.getTranscodeJobById(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check permissions for non-admin users
    const { userId, userRole } = getUserIdAndRole(req.user);
    if (userRole !== 'admin' && job.user_id !== userId) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);

  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// GET /transcode/download/:jobId - Generate pre-signed URL for processed video download
router.get('/download/:jobId', authenticateToken, async (req, res) => {
  try {
    // Ensure Cognito user exists in database (for DynamoDB)
    if (req.user.isCognito) {
      await database.createOrGetCognitoUser(req.user);
    }

    const { userId, userRole } = getUserIdAndRole(req.user);
    console.log('[DEBUG] Download request for job:', req.params.jobId, 'by user:', userId);

    const job = await database.getTranscodeJobById(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Completed job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(404).json({ error: 'Completed job not found' });
    }

    // Check permissions - regular users can only download their own jobs
    if (userRole !== 'admin' && job.user_id !== userId) {
      return res.status(404).json({ error: 'Completed job not found' });
    }

    // S3-only: Generate pre-signed URL for processed video download
    if (!job.output_storage_key) {
      return res.status(404).json({ error: 'Output file not found in S3' });
    }

    // Generate pre-signed URL for processed video download (valid for 1 hour)
    const downloadUrl = await storage.getFileUrl(job.output_storage_key, 3600, 'processed');

    const baseFilename = job.original_filename.replace(/\.[^/.]+$/, '');
    const repeatSuffix = job.repeat_count > 1 ? `_${job.repeat_count}x` : '';
    const filename = `transcoded_${baseFilename}_${job.target_resolution}${repeatSuffix}.${job.target_format}`;

    return res.json({
      downloadUrl: downloadUrl,
      filename: filename,
      expiresIn: 3600 // seconds
    });

  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// GET /transcode/progress/:jobId - Get progress for specific job (polling)
router.get('/progress/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await database.getTranscodeJobById(jobId);

    if (job) {
      console.log(`📋 Progress requested for ${jobId}: ${job.progress || 0}%`);
      res.json({
        jobId,
        status: job.status,
        progress: job.progress || 0,
        message: job.error_message || 'Processing...'
      });
    } else {
      res.json({
        jobId,
        status: 'unknown',
        progress: 0,
        message: 'Job not found'
      });
    }
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});


// GET /transcode/stats - System statistics (admin only)
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get all jobs and count by status
    const allJobs = await database.getAllTranscodeJobs();

    const totalJobs = allJobs.length;
    const activeJobs = allJobs.filter(job => job.status === 'processing').length;
    const completedJobs = allJobs.filter(job => job.status === 'completed').length;
    const failedJobs = allJobs.filter(job => job.status === 'failed').length;

    res.json({
      totalJobs,
      activeJobs,
      completedJobs,
      failedJobs,
      diskUsage: 'Check AWS console for disk usage'
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

// ASYNC FUNCTION: CPU-intensive video transcoding with cloud storage support
async function transcodeVideoAsync(job) {
  const startTime = Date.now();
  let inputPath = job.file_path;
  let outputPath = path.join('uploads', 'processed', `${job.id}.${job.target_format}`);
  let tempInputPath = null;
  let outputStorageKey = null;
  
  try {
    const repeatCount = job.repeat_count || 1;
    console.log(`Starting CPU-intensive transcoding for job ${job.id}`);
    console.log(`Input: ${job.file_path}`);
    console.log(`Target: ${job.target_resolution} ${job.target_format}`);
    console.log(`Quality: ${job.quality_preset || 'medium'} | Bitrate: ${job.bitrate || '1000k'}`);
    console.log(`Repeat Count: ${repeatCount}x (for sustained CPU load)`);

    // Check if we need to download the input file from cloud storage
    if (process.env.STORAGE_PROVIDER === 's3' && job.storage_key) {
      console.log(`Downloading input file from cloud storage: ${job.storage_key}`);
      const downloadResult = await storage.downloadFile(job.storage_key);
      
      // Create temporary file for FFmpeg processing
      tempInputPath = path.join('uploads', 'temp', `input_${job.id}_${Date.now()}.tmp`);
      await fs.promises.mkdir(path.dirname(tempInputPath), { recursive: true });
      await fs.promises.writeFile(tempInputPath, downloadResult.buffer);
      inputPath = tempInputPath;
      
      console.log(`Downloaded and cached input file: ${tempInputPath}`);
    }

    // Ensure output directory exists
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

    // Store all iteration file paths for later concatenation
    const iterationPaths = [];

    // Process video multiple times for sustained CPU load  
    for (let iteration = 1; iteration <= repeatCount; iteration++) {
      // Always create iteration-specific files for concatenation
      const currentOutputPath = path.join('uploads', 'processed', `${job.id}_iteration_${iteration}.${job.target_format}`);
      iterationPaths.push(currentOutputPath);
      
      
      await new Promise((resolve, reject) => {
      const qualityPreset = job.quality_preset || 'medium';
      const bitrate = job.bitrate || '1000k';
      
      // Configure codecs and options based on target format
      let videoCodec, audioCodec, formatSpecificOptions = [];
      
      if (job.target_format === 'webm') {
        // WebM format: use VP8 video codec and Vorbis audio codec (more reliable)
        videoCodec = 'libvpx';
        audioCodec = 'libvorbis';
        
        // WebM-specific options (VP8 quality settings)
        const vpxPresetMap = {
          'ultrafast': '0',  // Fastest encoding
          'fast': '1',       // Fast encoding
          'medium': '2',     // Balanced (default)
          'slow': '4',       // Slower, better quality
          'veryslow': '5'    // Slowest, best quality
        };
        
        formatSpecificOptions = [
          '-cpu-used', vpxPresetMap[qualityPreset] || '2'
        ];
      } else {
        // MP4 format: use H.264 video codec and AAC audio codec
        videoCodec = 'libx264';
        audioCodec = 'aac';
        
        // MP4-specific options (H.264 preset)
        formatSpecificOptions = [
          '-preset', qualityPreset,
          '-movflags', '+faststart'  // Optimize for streaming
        ];
      }
      
      let command = ffmpeg(inputPath)
        .videoCodec(videoCodec)         // Format-specific video codec
        .audioCodec(audioCodec)         // Format-specific audio codec
        .size(job.target_resolution)    // Resize video (very CPU heavy)
        .videoBitrate(bitrate)          // User-selected bitrate
        .audioBitrate('128k')           // Limit audio bitrate
        .addOption('-threads', '0')     // Auto-detect CPU threads (optimal for any instance type)
        .addOption('-bufsize', '2M')    // Buffer size limit
        .addOption('-maxrate', bitrate) // Max bitrate to prevent spikes
        .format(job.target_format);     // Format conversion
      
      // Add format-specific options in pairs
      for (let i = 0; i < formatSpecificOptions.length; i += 2) {
        const optionName = formatSpecificOptions[i];
        const optionValue = formatSpecificOptions[i + 1];
        if (optionName && optionValue) {
          command = command.addOption(optionName, optionValue);
        }
      }
      
      command
        .on('start', async (commandLine) => {
          console.log(`FFmpeg command: ${commandLine}`);

          // Store start progress
          await updateProgress(job.id, 'processing', 0, { message: 'Transcoding started...' });
        })
        .on('progress', async (progress) => {
          const percent = Math.round(progress.percent || 0);
          const currentTime = progress.timemark || '00:00:00';
          const currentKbs = Math.round(progress.currentKbps || 0);

          console.log(`Processing: ${percent}% done (${currentTime}, ${currentKbs}kb/s)`);

          // Store real-time progress
          await updateProgress(job.id, 'processing', percent, {
            timemark: currentTime,
            kbps: currentKbs,
            fps: Math.round(progress.currentFps || 0)
          });
        })
        .on('end', () => {
          console.log(`Transcoding completed for job ${job.id}`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`FFmpeg error for job ${job.id}:`, err.message);
          
          // Provide specific guidance for common errors
          let userFriendlyError = err.message;
          if (err.message.includes('SIGKILL') || err.message.includes('killed')) {
            userFriendlyError = 'Processing failed due to insufficient memory or CPU resources. Try using a faster preset (ultrafast/fast) or smaller resolution.';
          } else if (err.message.includes('No space left')) {
            userFriendlyError = 'Processing failed due to insufficient disk space.';
          } else if (err.message.includes('Input/output error')) {
            userFriendlyError = 'Input file may be corrupted or in an unsupported format.';
          }
          
          const enhancedError = new Error(userFriendlyError);
          enhancedError.originalError = err.message;
          reject(enhancedError);
        })
        .save(currentOutputPath);
      });
    }

    // If repeat count > 1, concatenate all iterations into a single video
    
    if (repeatCount > 1) {
      
      await new Promise((resolve, reject) => {
        // Use FFmpeg's file-based concatenation method (more reliable)
        const concatListPath = path.join('uploads', 'processed', `${job.id}_concat_list.txt`);
        
        // Create concat list file
        const concatList = iterationPaths.map(filePath => `file '${path.resolve(filePath)}'`).join('\n');
        
        
        // Write the concat list to file
        fs.writeFileSync(concatListPath, concatList);
        
        // Create FFmpeg command using file-based concatenation
        const command = ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .videoCodec('copy')  // Use copy for speed since all files have same encoding
          .audioCodec('copy')  // Use copy for speed since all files have same encoding
          .format(job.target_format)
          .on('start', (commandLine) => {
            console.log(`Concatenation FFmpeg command: ${commandLine}`);
          })
          .on('progress', async (progress) => {
            const percent = Math.round(progress.percent || 0);
            console.log(`Concatenating: ${percent}% complete`);

            // Store concatenation progress
            const finalPercent = Math.min(95 + Math.round(percent / 20), 99);
            await updateProgress(job.id, 'processing', finalPercent, {
              stage: 'finalizing',
              message: `Stitching ${repeatCount} iterations together...`
            });
          })
          .on('end', () => {
            
            // Clean up concat list file
            try {
              fs.unlinkSync(concatListPath);
            } catch (err) {
              console.warn(`Warning: Could not clean up concat list file: ${err.message}`);
            }
            
            resolve();
          })
          .on('error', (err) => {
            console.error(`Concatenation error:`, err.message);
            
            // Clean up concat list file on error
            try {
              fs.unlinkSync(concatListPath);
            } catch (cleanupErr) {
              console.warn(`Warning: Could not clean up concat list file on error: ${cleanupErr.message}`);
            }
            
            reject(new Error(`Failed to concatenate video iterations: ${err.message}`));
          })
          .save(outputPath);
      });
      
      // Clean up individual iteration files after successful concatenation
      for (const filePath of iterationPaths) {
        try {
          await fs.promises.unlink(filePath);
        } catch (err) {
          console.warn(`Warning: Could not clean up iteration file ${filePath}: ${err.message}`);
        }
      }
    } else {
      // If only 1 iteration, rename the single file to the final output path
      if (iterationPaths.length === 1) {
        await fs.promises.rename(iterationPaths[0], outputPath);
      }
    }

    // Upload processed file to cloud storage if using cloud provider
    if (process.env.STORAGE_PROVIDER === 's3') {
      console.log(`Uploading processed file to cloud storage...`);
      const outputBuffer = await fs.promises.readFile(outputPath);
      const outputFilename = `transcoded_${job.id}_${job.target_resolution}.${job.target_format}`;
      
      const uploadResult = await storage.uploadFile(outputBuffer, outputFilename, {
        category: 'processed',
        contentType: `video/${job.target_format}`,
        userId: job.user_id
      });
      
      outputStorageKey = uploadResult.key;
      outputPath = uploadResult.location;
      
      console.log(`Uploaded processed file to cloud: ${outputStorageKey}`);
      
      // S3-only: No local cleanup needed
    }

    // Update job as completed
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    
    await database.updateTranscodeJob(job.id, {
      status: 'completed',
      completed_at: true,
      output_path: outputPath,
      processing_time_seconds: processingTime,
      output_storage_key: outputStorageKey
    });

    console.log(`Job ${job.id} completed in ${processingTime} seconds`);

    // Store completion
    await updateProgress(job.id, 'completed', 100, {
      processingTime: processingTime,
      message: 'Transcoding complete!'
    });

  } catch (error) {
    console.error(`Transcoding failed for job ${job.id}:`, error.message);
    
    // Update job as failed
    await database.updateTranscodeJob(job.id, {
      status: 'failed',
      error_message: error.message,
      completed_at: true
    });

    // Store failure
    await updateProgress(job.id, 'failed', 0, {
      error: error.message
    });
  } finally {
    // Clean up temporary input file if it was created
    if (tempInputPath) {
      try {
        await fs.promises.unlink(tempInputPath);
      } catch (err) {
        console.warn(`Warning: Could not clean up temporary file: ${err.message}`);
      }
    }
  }
}

module.exports = router;