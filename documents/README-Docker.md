# Docker Deployment Guide

## Multi-Container Setup

This project uses Docker Compose to orchestrate multiple containers:

### Services

1. **PostgreSQL Database** (`postgres`)
   - Image: `postgres:15-alpine`
   - Port: `5432`
   - Database: `video_transcoding`
   - User: `transcoder`
   - Password: `transcoder123`

2. **Node.js Application** (`app`)
   - Built from local Dockerfile
   - Port: `3000`
   - Includes FFmpeg and YouTube downloading capabilities

3. **Redis Cache** (`redis`)
   - Image: `redis:7-alpine`
   - Port: `6379`
   - Used for session management and job queuing

### Quick Start

```bash
# Build and start all services
npm run docker:up

# View logs
npm run docker:logs

# Stop all services
npm run docker:down
```

### Manual Commands

```bash
# Build the application image
docker build -t video-transcoder .

# Start the stack
docker-compose up -d

# View running containers
docker-compose ps

# Access logs
docker-compose logs -f app
docker-compose logs -f postgres

# Stop everything
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v
```

### Environment Variables

The application automatically detects Docker environment:
- `DB_TYPE=postgres` - Uses PostgreSQL instead of SQLite
- `DB_HOST=postgres` - Database hostname
- `DB_PORT=5432` - Database port
- `DB_NAME=video_transcoding` - Database name
- `DB_USER=transcoder` - Database user
- `DB_PASSWORD=transcoder123` - Database password

### Volumes

- `./uploads:/app/uploads` - Video files persistence
- `./data:/app/data` - Local data (logs, temp files)
- `postgres_data` - PostgreSQL data persistence
- `redis_data` - Redis data persistence

### Health Checks

All services include health checks:
- **App**: HTTP GET to `/health`
- **PostgreSQL**: `pg_isready` command
- **Redis**: `redis-cli ping` command

### Production Considerations

For production deployment:

1. Change default passwords in `docker-compose.yml`
2. Use environment variable files (`.env`)
3. Configure proper networking and security
4. Set up backup strategies for volumes
5. Configure resource limits
6. Use a reverse proxy (nginx) for load balancing

### Troubleshooting

**Container fails to start:**
```bash
docker-compose logs <service-name>
```

**Database connection issues:**
```bash
# Check if PostgreSQL is ready
docker-compose exec postgres pg_isready -U transcoder

# Access database directly
docker-compose exec postgres psql -U transcoder -d video_transcoding
```

**FFmpeg issues:**
```bash
# Test FFmpeg in container
docker-compose exec app ffmpeg -version

# Test YouTube downloading
docker-compose exec app youtube-dl --version
```

**Port conflicts:**
- Change ports in `docker-compose.yml` if 3000, 5432, or 6379 are in use
- Update port mappings: `"<host-port>:<container-port>"`