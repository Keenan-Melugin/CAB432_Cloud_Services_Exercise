// Environment configuration (no dotenv needed for local development)

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

// Import route modules and database
const database = require('./utils/database-abstraction');
const authRoutes = require('./routes/auth');
const videoRoutes = require('./routes/videos');
const transcodeRoutes = require('./routes/transcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files (simple HTML UI)
app.use(express.static('public'));

// Create necessary directories
async function initializeDirectories() {
  const directories = [
    './uploads',
    './uploads/original',
    './uploads/processed',
    './data',
    './public'
  ];
  
  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`Directory created: ${dir}`);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.error(`Error creating directory ${dir}:`, error.message);
      }
    }
  }
}

// API Routes
app.use('/auth', authRoutes);
app.use('/videos', videoRoutes);
app.use('/transcode', transcodeRoutes);

// Basic homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Video Transcoding Service',
    timestamp: new Date().toISOString()
  });
});

// Initialize and start server
async function startServer() {
  try {
    await initializeDirectories();
    await database.init(); // Initialize database with tables and users
    
    app.listen(PORT, () => {
      console.log('Video Transcoding Service Started');
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log('Upload directory: ./uploads/');
      console.log('Default users: user1/password, admin1/password');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();