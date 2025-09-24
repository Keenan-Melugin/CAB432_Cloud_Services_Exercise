const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const database = require('../utils/database');
const { authenticateToken } = require('../utils/auth');
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
    const videoId = uuidv4();
    
    // Get file size in MB
    const sizeMB = file.size / (1024 * 1024);

    // Generate unique filename
    const uniqueFilename = `${req.user.username}_${Date.now()}_${file.originalname}`;

    // Upload file using storage abstraction layer
    const storageResult = await storage.uploadFile(file.buffer, uniqueFilename, {
      category: 'original',
      contentType: file.mimetype,
      userId: req.user.id
    });

    // Save video metadata to database
    await database.run(
      `INSERT INTO videos (id, user_id, filename, original_name, file_path, size_mb, format, storage_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        videoId,
        req.user.id,
        uniqueFilename,
        file.originalname,
        storageResult.location,
        sizeMB.toFixed(2),
        path.extname(file.originalname).substring(1),
        storageResult.key
      ]
    );

    console.log(`Video uploaded: ${file.originalname} (${sizeMB.toFixed(2)}MB) by ${req.user.username} -> ${storageResult.key}`);

    res.json({
      message: 'Video uploaded successfully',
      video: {
        id: videoId,
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
    let query = 'SELECT * FROM videos';
    let params = [];

    // Regular users see only their videos, admins see all
    if (req.user.role !== 'admin') {
      query += ' WHERE user_id = ?';
      params = [req.user.id];
    }
    
    query += ' ORDER BY uploaded_at DESC';

    const videos = await database.all(query, params);

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
    let query = 'SELECT * FROM videos WHERE id = ?';
    let params = [req.params.id];

    // Regular users can only see their own videos
    if (req.user.role !== 'admin') {
      query += ' AND user_id = ?';
      params.push(req.user.id);
    }

    const video = await database.get(query, params);

    if (!video) {
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
    let query = 'SELECT * FROM videos WHERE id = ?';
    let params = [req.params.id];

    // Regular users can only download their own videos
    if (req.user.role !== 'admin') {
      query += ' AND user_id = ?';
      params.push(req.user.id);
    }

    const video = await database.get(query, params);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Generate pre-signed URL for download (valid for 1 hour)
    const downloadUrl = await storage.getFileUrl(video.storage_key, 3600);

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