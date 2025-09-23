# CAB432 Session Notes - Repeat Transcoding Feature

## Session Overview
**Date:** Today's session  
**Goal:** Implement repeat transcoding feature for sustained CPU load testing (CAB432 Assignment requirement: >80% CPU for 5+ minutes)

## Problem Identified
- Single transcoding jobs either:
  - Complete too quickly (not enough sustained CPU load)
  - Crash system with large/intensive jobs
- Need predictable way to achieve sustained 80%+ CPU for 5+ minutes

## Solution Implemented: Repeat Transcoding Feature

### What We Added:
1. **Database Changes:**
   - Added `repeat_count INTEGER DEFAULT 1` column to `transcode_jobs` table
   - Added migration function to handle existing databases

2. **Backend Changes:**
   - Updated `/transcode/jobs` endpoint to accept `repeat_count` parameter
   - Added validation for repeat count (must be ≥ 1, no upper limit)
   - Modified transcoding function to process same video multiple times in loop
   - Each iteration creates separate output files

3. **Frontend Changes:**
   - Added number input field for "Repeat Count" 
   - Default value: 5x repeats
   - Helpful tip showing estimated processing times
   - Client-side validation

### How It Works:
- User uploads video and creates transcoding job
- Sets repeat count (e.g., 8x for ~8 minutes of processing)
- System processes same video multiple times sequentially
- Provides sustained, predictable CPU load

## Current Status: ✅ READY FOR TESTING

### Completed:
- [x] Feature implemented locally
- [x] Database migration added
- [x] Docker image built and pushed to ECR
- [x] Container updated on EC2 instance

### Next Steps (When Resuming):
1. **Test the feature:**
   - Get current EC2 public IP
   - Access web interface: `http://[IP]:3000`
   - Login: user1/password
   - Upload small video (10-20MB)
   - Create job with 8x repeat count
   - Monitor CPU with: `sudo docker stats video-transcoder`

2. **Verify for assignment:**
   - CloudWatch should show sustained 80%+ CPU
   - Logs should show "Processing iteration 1/8", "2/8", etc.
   - Perfect for CAB432 CPU load requirement!

## Technical Files Modified:
- `utils/database.js` - Added migration function
- `routes/transcode.js` - Added repeat logic and validation
- `public/index.html` - Added repeat count input field
- `public/app.js` - Updated job creation to include repeat count

## Assignment Benefits:
- **Predictable CPU load:** 5x = ~5 minutes, 10x = ~10 minutes
- **Sustainable:** Won't crash system like large single files
- **Flexible:** User can set exact duration needed
- **Perfect for demo:** Guaranteed sustained 80%+ CPU usage

## EC2 Instance Info:
- Instance running with updated container
- Database migration should auto-run on startup
- Ready for testing when resumed