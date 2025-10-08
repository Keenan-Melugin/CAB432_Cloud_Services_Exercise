// Standalone Transcoding Worker for ECS
// Polls SQS queue, processes transcoding jobs, and updates status
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// Import existing utilities from main application
const database = require('../utils/database-abstraction');
const storage = require('../utils/storage');
const cache = require('../utils/cache');

// Configuration
const QUEUE_URL = process.env.SQS_QUEUE_URL || 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/n10992511-transcode-jobs';
const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-2';
const POLL_INTERVAL = 1000; // 1 second between polls if no messages

const sqsClient = new SQSClient({ region: AWS_REGION });

// Graceful shutdown handling
let isShuttingDown = false;
let currentJob = null;

// Update job progress in DynamoDB and Redis cache
async function updateProgress(jobId, status, percent = 0, details = {}) {
  try {
    const progressData = {
      status: status,
      progress: percent,
      timestamp: new Date().toISOString(),
      ...details
    };

    // Update database
    await database.updateTranscodeJob(jobId, progressData);

    // Cache progress for fast polling access
    await cache.cacheJobProgress(jobId, progressData);

    console.log(`📊 Progress stored: ${jobId} -> ${percent}% (${status})`);
  } catch (error) {
    console.error(`Failed to update progress for job ${jobId}:`, error);
  }
}

// Core transcoding logic (extracted from routes/transcode.js)
async function transcodeVideo(job) {
  const startTime = Date.now();
  let inputPath = job.file_path;
  let outputPath = path.join('/tmp', 'processed', `${job.id}.${job.target_format}`);
  let outputStorageKey = null;
  
  try {
    const repeatCount = job.repeat_count || 1;
    console.log(`🎬 Starting transcoding for job ${job.id}`);
    console.log(`   Input: ${job.file_path || job.storage_key}`);
    console.log(`   Target: ${job.target_resolution} ${job.target_format}`);
    console.log(`   Quality: ${job.quality_preset || 'medium'} | Bitrate: ${job.bitrate || '1000k'}`);
    console.log(`   Repeat Count: ${repeatCount}x`);

    // Use signed URL for S3 files
    if (job.storage_key) {
      console.log(`📥 Generating signed URL for S3 file: ${job.storage_key}`);
      const signedUrl = await storage.getFileUrl(job.storage_key, 7200, 'original');
      inputPath = signedUrl;
      console.log(`   Using signed URL for FFmpeg input`);
    }

    // Ensure output directory exists
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

    // Store all iteration file paths
    const iterationPaths = [];

    // Process video multiple times if needed
    for (let iteration = 1; iteration <= repeatCount; iteration++) {
      const currentOutputPath = path.join('/tmp', 'processed', `${job.id}_iteration_${iteration}.${job.target_format}`);
      iterationPaths.push(currentOutputPath);
      
      await new Promise((resolve, reject) => {
        const qualityPreset = job.quality_preset || 'medium';
        const bitrate = job.bitrate || '1000k';
        
        // Configure codecs based on format
        let videoCodec, audioCodec, formatSpecificOptions = [];
        
        if (job.target_format === 'webm') {
          videoCodec = 'libvpx';
          audioCodec = 'libvorbis';
          const vpxPresetMap = {
            'ultrafast': '0', 'fast': '1', 'medium': '2',
            'slow': '4', 'veryslow': '5'
          };
          formatSpecificOptions = ['-cpu-used', vpxPresetMap[qualityPreset] || '2'];
        } else {
          videoCodec = 'libx264';
          audioCodec = 'aac';
          formatSpecificOptions = ['-preset', qualityPreset, '-movflags', '+faststart'];
        }
        
        let command = ffmpeg(inputPath)
          .videoCodec(videoCodec)
          .audioCodec(audioCodec)
          .size(job.target_resolution)
          .videoBitrate(bitrate)
          .audioBitrate('128k')
          .addOption('-threads', '0')
          .addOption('-bufsize', '2M')
          .addOption('-maxrate', bitrate)
          .format(job.target_format);
        
        // Add format-specific options
        for (let i = 0; i < formatSpecificOptions.length; i += 2) {
          const optionName = formatSpecificOptions[i];
          const optionValue = formatSpecificOptions[i + 1];
          if (optionName && optionValue) {
            command = command.addOption(optionName, optionValue);
          }
        }
        
        command
          .on('start', async (commandLine) => {
            console.log(`   FFmpeg command: ${commandLine.substring(0, 100)}...`);
            await updateProgress(job.id, 'processing', 0, { message: 'Transcoding started...' });
          })
          .on('progress', async (progress) => {
            const percent = Math.round(progress.percent || 0);
            const currentTime = progress.timemark || '00:00:00';
            const currentKbs = Math.round(progress.currentKbps || 0);

            console.log(`   Processing: ${percent}% done (${currentTime}, ${currentKbs}kb/s)`);

            await updateProgress(job.id, 'processing', percent, {
              timemark: currentTime,
              kbps: currentKbs,
              fps: Math.round(progress.currentFps || 0)
            });
          })
          .on('end', () => {
            console.log(`   ✅ Iteration ${iteration} complete`);
            resolve();
          })
          .on('error', (err) => {
            console.error(`   ❌ FFmpeg error:`, err.message);
            
            let userFriendlyError = err.message;
            if (err.message.includes('SIGKILL') || err.message.includes('killed')) {
              userFriendlyError = 'Processing failed due to insufficient memory or CPU resources.';
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

    // Concatenate if multiple iterations
    if (repeatCount > 1) {
      await new Promise((resolve, reject) => {
        const concatListPath = path.join('/tmp', 'processed', `${job.id}_concat_list.txt`);
        const concatList = iterationPaths.map(filePath => `file '${path.resolve(filePath)}'`).join('\n');
        fs.writeFileSync(concatListPath, concatList);
        
        const command = ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .videoCodec('copy')
          .audioCodec('copy')
          .format(job.target_format)
          .on('start', (commandLine) => {
            console.log(`   📦 Concatenating ${repeatCount} iterations...`);
          })
          .on('progress', async (progress) => {
            const percent = Math.round(progress.percent || 0);
            const finalPercent = Math.min(95 + Math.round(percent / 20), 99);
            await updateProgress(job.id, 'processing', finalPercent, {
              stage: 'finalizing',
              message: `Stitching ${repeatCount} iterations together...`
            });
          })
          .on('end', () => {
            try { fs.unlinkSync(concatListPath); } catch (err) {}
            resolve();
          })
          .on('error', (err) => {
            try { fs.unlinkSync(concatListPath); } catch (cleanupErr) {}
            reject(new Error(`Failed to concatenate: ${err.message}`));
          })
          .save(outputPath);
      });
      
      // Clean up iteration files
      for (const filePath of iterationPaths) {
        try {
          await fs.promises.unlink(filePath);
        } catch (err) {
          console.warn(`   Warning: Could not clean up ${filePath}`);
        }
      }
    } else {
      // Single iteration - rename to final output
      if (iterationPaths.length === 1) {
        await fs.promises.rename(iterationPaths[0], outputPath);
      }
    }

    // Upload to S3
    console.log(`   📤 Uploading processed file to S3...`);
    const outputBuffer = await fs.promises.readFile(outputPath);
    const outputFilename = `transcoded_${job.id}_${job.target_resolution}.${job.target_format}`;

    const uploadResult = await storage.uploadFile(outputBuffer, outputFilename, {
      category: 'processed',
      contentType: `video/${job.target_format}`,
      userId: job.user_id
    });

    outputStorageKey = uploadResult.key;
    console.log(`   ✅ Uploaded to S3: ${outputStorageKey}`);

    // Clean up local file
    try {
      await fs.promises.unlink(outputPath);
    } catch (err) {
      console.warn(`   Warning: Could not clean up local file`);
    }

    // Update job as completed
    const processingTime = Math.round((Date.now() - startTime) / 1000);

    await database.updateTranscodeJob(job.id, {
      status: 'completed',
      completed_at: true,
      output_path: uploadResult.location,
      processing_time_seconds: processingTime,
      output_storage_key: outputStorageKey
    });

    console.log(`   ✅ Job ${job.id} completed in ${processingTime} seconds`);

    await updateProgress(job.id, 'completed', 100, {
      processingTime: processingTime,
      message: 'Transcoding complete!'
    });

    // Invalidate user's job cache
    await cache.invalidateUserJobs(job.user_id);

  } catch (error) {
    console.error(`   ❌ Transcoding failed for job ${job.id}:`, error.message);

    // Update job as failed
    await database.updateTranscodeJob(job.id, {
      status: 'failed',
      error_message: error.message,
      completed_at: true
    });

    await updateProgress(job.id, 'failed', 0, {
      error: error.message
    });

    await cache.invalidateUserJobs(job.user_id);
    
    throw error; // Re-throw to prevent SQS message deletion
  }
}

// Poll SQS queue for new jobs
async function pollQueue() {
  console.log('🔍 Polling SQS queue for new jobs...');
  
  const receiveCommand = new ReceiveMessageCommand({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20, // Long polling
    MessageAttributeNames: ['All']
  });

  try {
    const result = await sqsClient.send(receiveCommand);
    
    if (result.Messages && result.Messages.length > 0) {
      const message = result.Messages[0];
      console.log(`\n📩 Received message: ${message.MessageId}`);
      
      try {
        // Parse job from message
        const job = JSON.parse(message.Body);
        currentJob = job;
        
        console.log(`🎯 Processing job ${job.id || job.jobId}`);
        
        // Process the transcoding job
        await transcodeVideo(job);
        
        // Delete message from queue (job completed successfully)
        const deleteCommand = new DeleteMessageCommand({
          QueueUrl: QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle
        });
        
        await sqsClient.send(deleteCommand);
        console.log(`✅ Message deleted from queue`);
        
      } catch (error) {
        console.error(`❌ Job processing failed:`, error.message);
        // Message will not be deleted - will be requeued after visibility timeout
        // or sent to DLQ after max retries
      }
      
      currentJob = null;
    } else {
      console.log('   No messages available');
    }
    
  } catch (error) {
    console.error(`❌ SQS polling error:`, error.message);
  }
}

// Main worker loop
async function startWorker() {
  console.log('🚀 Transcoding Worker Started');
  console.log(`   Queue: ${QUEUE_URL}`);
  console.log(`   Region: ${AWS_REGION}`);
  console.log('');
  
  while (!isShuttingDown) {
    await pollQueue();
    
    // Brief pause between polls if no message
    if (!currentJob) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }
  
  console.log('👋 Worker shutdown complete');
}

// Graceful shutdown handler
function handleShutdown(signal) {
  console.log(`\n⚠️  Received ${signal} signal`);
  
  if (currentJob) {
    console.log(`   Finishing current job: ${currentJob.id}`);
    console.log(`   Please wait...`);
  }
  
  isShuttingDown = true;
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Start the worker
startWorker().catch(error => {
  console.error('❌ Worker crashed:', error);
  process.exit(1);
});
