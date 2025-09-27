#!/bin/bash

# Simple wrapper script for data cleanup
# Usage: ./scripts/clean-all-data.sh [--live] [--yes]

echo "🧹 Video Transcoder Data Cleanup"
echo "================================="

# Change to project root
cd "$(dirname "$0")/.."

# Default to dry run unless --live is specified
if [[ "$*" == *"--live"* ]]; then
    echo "⚠️  LIVE MODE: Data will be permanently deleted!"
else
    echo "🔍 DRY RUN MODE: No data will be deleted (use --live for actual cleanup)"
fi

# Run the Node.js cleanup script
node cleanup-data.js "$@"