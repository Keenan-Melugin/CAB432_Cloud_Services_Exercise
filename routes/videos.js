const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const database = require('../utils/database-abstraction');
const { authenticateToken, getUserIdAndRole } = require('../utils/auth');
const storage = require('../utils/storage');

const router = express.Router();

// Configure multer for video uploads - using memory storage for cloud compatibility
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check if file is a video (by mimetype or extension)
    const isVideo = file.mimetype.startsWith('video/') || 
                   ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(path.extname(file.originalname).toLowerCase());
    
    if (isVideo) {
      cb(null, true);
    } else {
      console.log(`File rejected: ${file.originalname}, MIME: ${file.mimetype}`);
      cb(new Error('Only video files are allowed!'), false);
    }
  }
});

// POST /videos/upload - Upload video file (now with cloud storage support)
router.post('/upload', authenticateToken, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const file = req.file;
    
    // Get file size in MB
    const sizeMB = file.size / (1024 * 1024);

    // Generate unique filename
    const { userId } = getUserIdAndRole(req.user);
    const username = req.user.isCognito ? req.user.email : req.user.username;
    const uniqueFilename = `${username}_${Date.now()}_${file.originalname}`;

    // Upload file using storage abstraction layer
    const storageResult = await storage.uploadFile(file.buffer, uniqueFilename, {
      category: 'original',
      contentType: file.mimetype,
      userId: userId
    });

    // Save video metadata to database
    const video = await database.createVideo({
      user_id: userId,
      filename: uniqueFilename,
      original_name: file.originalname,
      file_path: storageResult.location,
      size_mb: sizeMB.toFixed(2),
      format: path.extname(file.originalname).substring(1),
      storage_key: storageResult.key
    });

    console.log(`Video uploaded: ${file.originalname} (${sizeMB.toFixed(2)}MB) by ${req.user.username} -> ${storageResult.key}`);

    res.json({
      message: 'Video uploaded successfully',
      video: {
        id: video.id,
        filename: uniqueFilename,
        originalName: file.originalname,
        size: sizeMB.toFixed(2) + ' MB',
        storageKey: storageResult.key
      }
    });

  } catch (error) {
    console.error('Video upload error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
    } else {
      res.status(500).json({ error: 'Video upload failed: ' + error.message });
    }
  }
});

// GET /videos - List user's videos
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Use helper function for consistent user ID and role handling
    const { userId, userRole } = getUserIdAndRole(req.user);
    const videos = await database.getVideosByUser(userId, userRole);

    if (!Array.isArray(videos)) {
      return res.json([]);
    }

    const mappedVideos = videos.map(video => ({
      id: video.id,
      filename: video.original_name,
      uploaded: video.uploaded_at,
      size_mb: parseFloat(video.size_mb),
      format: video.format,
      user: video.user_id
    }));
    res.json(mappedVideos);

  } catch (error) {
    console.error('Error fetching videos:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch videos', details: error.message });
  }
});

// GET /videos/:id - Get specific video details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const video = await database.getVideoById(req.params.id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Regular users can only see their own videos
    const { userId, userRole } = getUserIdAndRole(req.user);
    if (userRole !== 'admin' && video.user_id !== userId) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({
      id: video.id,
      filename: video.original_name,
      uploaded: video.uploaded_at,
      size_mb: parseFloat(video.size_mb),
      format: video.format,
      duration: video.duration_seconds
    });

  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// GET /videos/:id/download - Generate pre-signed URL for video download
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const video = await database.getVideoById(req.params.id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check permissions - regular users can only download their own videos
    const { userId, userRole } = getUserIdAndRole(req.user);
    if (userRole !== 'admin' && video.user_id !== userId) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Generate pre-signed URL for download (valid for 1 hour)
    // For original videos, we need to specify it's from the original bucket
    const downloadUrl = await storage.getFileUrl(video.storage_key, 3600, 'original');

    res.json({
      downloadUrl: downloadUrl,
      filename: video.original_name,
      expiresIn: 3600 // seconds
    });

  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

module.exports = router;