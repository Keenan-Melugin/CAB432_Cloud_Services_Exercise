# Video Transcoding Service - CAB432 Assignment 1

A CPU-intensive video transcoding service built with Node.js, Docker, and FFmpeg for cloud computing coursework.

## Assignment Criteria

This project satisfies all **7 core criteria** for CAB432 Assignment 1:

1. **CPU Intensive Task** - Video transcoding using FFmpeg
2. **CPU Load Testing** - Load test script generates >80% CPU usage  
3. **Data Types** - SQLite (structured) + Video files (unstructured)
4. **Containerized App** - Fully dockerized application
5. **Deploy Container** - Deployable to AWS EC2 via ECR
6. **REST API** - Complete RESTful API for video operations
7. **User Login** - JWT authentication system

## Quick Start

### Local Development
```bash
# Install dependencies
npm install

# Start the server
npm start

# Access application
open http://localhost:3000
```

### Docker Deployment
```bash
# Build image
docker build -t video-transcoding-service .

# Run container
docker run -p 3000:3000 video-transcoding-service
```

### AWS EC2 Deployment
See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for complete AWS deployment instructions.

## Test Accounts

| Username | Password | Role  |
|----------|----------|-------|
| user1    | password | user  |
| admin1   | password | admin |
| user2    | password | user  |

## Features

### Core Functionality
- **Video Upload** - Support for MP4, MOV, AVI, MKV, WebM formats
- **Video Transcoding** - Convert videos to different resolutions and formats
- **Quality Control** - Multiple quality presets (ultrafast to veryslow)
- **Bitrate Selection** - Configurable bitrate from 500k to 8000k
- **Real-time Progress** - Live progress bars with Server-Sent Events
- **User Management** - JWT-based authentication system
- **Admin Features** - System statistics and management tools

### Technical Features
- **CPU Intensive Processing** - FFmpeg video transcoding
- **Data Storage** - SQLite database + file system storage
- **REST API** - Complete API for all operations
- **Containerization** - Docker support with multi-stage builds
- **Load Testing** - Built-in script for CPU load generation
- **Resource Management** - Configurable CPU and memory limits

## Load Testing

Generate high CPU load for assignment demonstration:

```bash
# Run load test (creates 3 simultaneous transcoding jobs)
npm run load-test

# Monitor CPU usage
top -p $(pgrep -f "node index.js")
```

**Expected Results:**
- CPU usage >80% for 5+ minutes
- 3 concurrent transcoding processes
- High memory and disk I/O usage

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   REST API      │    │   FFmpeg        │
│                 │───▶│                 │───▶│                 │
│ HTML/JS/CSS     │    │ Express.js      │    │ Video Processing│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌────────▼────────┐
                       │   Data Layer    │
                       │                 │
                       │ SQLite Database │
                       │ File System     │
                       └─────────────────┘
```

### Technology Stack
- **Backend**: Node.js with Express.js
- **Database**: SQLite (structured data)
- **Storage**: Local file system (unstructured data)  
- **Processing**: FFmpeg for video transcoding
- **Authentication**: JWT tokens
- **Frontend**: Vanilla HTML/JavaScript
- **Containerization**: Docker

## Project Structure

```
CAB432/
├── index.js              # Main server application
├── package.json          # Dependencies and scripts
├── Dockerfile            # Container configuration
├── DEPLOYMENT_GUIDE.md   # AWS deployment instructions
├── load_test.js          # CPU load testing script
├── routes/
│   ├── auth.js          # Authentication endpoints
│   ├── videos.js        # Video upload/management
│   └── transcode.js     # Transcoding operations
├── utils/
│   ├── auth.js          # JWT middleware
│   ├── database.js      # SQLite operations
│   └── storage.js       # File storage abstraction
├── public/
│   ├── index.html       # Web client interface
│   └── app.js           # Frontend JavaScript
├── uploads/
│   ├── original/        # Uploaded video files
│   └── processed/       # Transcoded output files
└── data/
    └── videos.db        # SQLite database
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration (admin only)

### Video Management  
- `GET /videos` - List user's videos
- `POST /videos/upload` - Upload video file
- `GET /videos/:id` - Get video details

### Transcoding Operations
- `POST /transcode/jobs` - Create transcoding job
- `GET /transcode/jobs` - List transcoding jobs
- `POST /transcode/start/:id` - Start processing job
- `GET /transcode/download/:id` - Download processed video
- `GET /transcode/events` - Server-Sent Events for real-time updates

### System Management
- `GET /transcode/stats` - System statistics (admin only)

## Configuration

### Environment Variables
```bash
PORT=3000                    # Server port
JWT_SECRET=your-secret-key   # JWT signing key
NODE_ENV=production          # Environment mode
```

### Docker Configuration
- **Base Image**: node:18-bullseye
- **Exposed Port**: 3000
- **Volume Mounts**: uploads/, data/
- **Resource Limits**: Configurable CPU/memory

### FFmpeg Settings
- **Threads**: 8 (configurable)
- **Buffer Size**: 2MB
- **Quality Presets**: ultrafast, fast, medium, slow, veryslow
- **Supported Formats**: MP4, WebM
- **Resolution Options**: 360p to 4K

## Performance Considerations

### CPU Usage
- **High CPU Load**: Expected during transcoding operations
- **Multi-threading**: FFmpeg uses 8 CPU cores by default
- **Resource Limits**: Configurable via environment variables

### Memory Usage  
- **File Buffering**: Videos processed in memory chunks
- **SQLite**: Lightweight database with minimal overhead
- **Container Limits**: 2GB RAM recommended minimum

### Storage Requirements
- **Original Videos**: Stored in uploads/original/
- **Processed Videos**: Stored in uploads/processed/
- **Database**: Minimal storage footprint (<10MB)

## Troubleshooting

### Common Issues

**Port 3000 Already in Use**
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9
```

**FFmpeg Not Found**
```bash
# Install FFmpeg (Ubuntu/Debian)
sudo apt update && sudo apt install ffmpeg

# Install FFmpeg (macOS)  
brew install ffmpeg
```

**High CPU Usage**
This is expected behavior! Video transcoding is CPU-intensive by design.

**Container Build Fails**
```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -t video-transcoding-service .
```

## Assignment Demonstration

### For Lecturers/Markers

1. **Access Application**: `http://[instance-ip]:3000`
2. **Login**: Use `admin1/password` for full access
3. **Upload Video**: Any MP4 file works well
4. **Create Job**: Select video, choose 720p, medium quality
5. **Start Processing**: Click "Start Processing" 
6. **Monitor CPU**: Use `top` or `htop` to observe >80% CPU usage
7. **Load Test**: Run `npm run load-test` for sustained high CPU load

### Evidence Collection
- Screenshots of application interface
- CPU usage during transcoding operations  
- Load testing results showing >80% CPU usage
- Network monitoring of REST API calls
- Container deployment from ECR

## Assignment Compliance

This implementation specifically addresses CAB432 Assignment 1 requirements:

- **Simplicity**: Focused on core criteria rather than production features
- **CPU Intensity**: Video transcoding provides genuine high CPU workload
- **Data Types**: Clear separation of structured (SQLite) and unstructured (files) data
- **Cloud Ready**: Containerized and deployable to AWS EC2
- **Demonstrable**: All features accessible through web interface
- **Load Testable**: Built-in tools for generating sustained CPU load

## Support

For assignment-specific questions, consult your CAB432 lecturer or tutor.

For technical issues, check the troubleshooting section or review application logs:
```bash
# Local development
npm start

# Docker container
docker logs video-transcoding-service
```

## Redis/ElastiCache Troubleshooting

### Quick Redis Test
```bash
# Test Redis connectivity
node test-redis.js
```

### Common Issues:

**Redis Connection Failed (ETIMEDOUT/ECONNREFUSED)**
- ElastiCache may be blocked by institutional firewall (common in QUT AWS)
- Application uses graceful degradation - continues working with mock Redis
- For local testing: `sudo apt install redis-server && sudo systemctl start redis-server`
- Set environment: `export REDIS_HOST="127.0.0.1"`

**DNS Resolution Failed (ENOTFOUND)**
- Check ElastiCache endpoint: `terraform output elasticache_redis_endpoint`
- Update environment variable with correct endpoint

**Performance Impact Without Redis**
- Cache operations become no-ops
- Slightly slower response times (no caching benefits)
- All core functionality still works
- Rate limiting disabled