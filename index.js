// Environment configuration (no dotenv needed for local development)

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const https = require('https');

// Import route modules and database
const database = require('./utils/database-abstraction');
const authRoutes = require('./routes/auth');
const videoRoutes = require('./routes/videos');
const transcodeRoutes = require('./routes/transcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Serve static files (simple HTML UI)
app.use(express.static('public'));

// Create minimal necessary directories (only for temp processing)
async function initializeDirectories() {
  const directories = [
    './uploads/temp',  // Only for temporary processing files
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

// Start HTTPS server with improved error handling
async function startHTTPSServer(app) {
  const httpsPort = process.env.HTTPS_PORT || 443;
  const keyPath = '/opt/ssl/private-key.pem';
  const certPath = '/opt/ssl/certificate.pem';

  try {
    // Check if SSL files exist first
    await fs.access(keyPath);
    await fs.access(certPath);

    console.log('📁 SSL certificates found, starting HTTPS server...');

    // Read SSL certificates
    const sslOptions = {
      key: await fs.readFile(keyPath),
      cert: await fs.readFile(certPath)
    };

    // Create and start HTTPS server
    const httpsServer = https.createServer(sslOptions, app);

    await new Promise((resolve, reject) => {
      httpsServer.listen(httpsPort, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });

      httpsServer.on('error', (err) => {
        reject(err);
      });
    });

    console.log(`✅ HTTPS Server running on https://localhost:${httpsPort}`);
    console.log(`🔒 Secure health check: https://localhost:${httpsPort}/health`);
    console.log('🔐 SSL/TLS encryption enabled');

  } catch (error) {
    console.log('⚠️  HTTPS server failed to start');
    console.log(`   Error: ${error.message}`);

    if (error.code === 'ENOENT') {
      console.log('   SSL certificates not found at /opt/ssl/');
      console.log('   Run: sudo ./scripts/setup-ssl.sh');
    } else if (error.code === 'EADDRINUSE') {
      console.log(`   Port ${httpsPort} is already in use`);
    } else if (error.code === 'EACCES') {
      console.log(`   Permission denied for port ${httpsPort}`);
      console.log('   Try setting HTTPS_PORT to a port > 1024');
    } else {
      console.log(`   SSL Error: ${error.code || 'Unknown error'}`);
    }

    console.log('   Continuing with HTTP-only mode...');
  }
}

// Initialize and start server
async function startServer() {
  try {
    await initializeDirectories();
    await database.init(); // Initialize database with tables and users

    // Start HTTP server (for backwards compatibility)
    app.listen(PORT, () => {
      console.log('Video Transcoding Service Started');
      console.log(`HTTP Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });

    // Start HTTPS server if SSL certificates are available
    await startHTTPSServer(app);

    console.log('Upload directory: ./uploads/');
    console.log('Default users: user1/password, admin1/password');

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();