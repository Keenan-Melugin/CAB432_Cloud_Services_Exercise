#!/bin/bash

# Fix merge conflict script for EC2 instance
echo "Fixing merge conflict in utils/storage.js..."

# Stop containers first
echo "Stopping containers..."
docker-compose down

# Check git status
echo "Git status:"
git status

# Take our version (the S3-only version)
echo "Resolving conflict by taking remote version..."
git checkout --theirs utils/storage.js

# Add and commit the resolution
git add utils/storage.js
git commit -m "Resolve merge conflict - use S3-only storage implementation"

echo "Conflict resolved. You can now run: docker-compose up -d"