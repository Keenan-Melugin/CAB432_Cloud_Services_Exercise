-- Initial database setup for PostgreSQL
-- This file is executed when the PostgreSQL container starts for the first time

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    size_mb DECIMAL(10,2) NOT NULL,
    duration_seconds INTEGER,
    format VARCHAR(10),
    storage_key VARCHAR(255),
    youtube_url TEXT,
    youtube_title TEXT,
    youtube_uploader VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transcode_jobs table
CREATE TABLE IF NOT EXISTS transcode_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    video_id UUID NOT NULL REFERENCES videos(id),
    original_filename VARCHAR(255) NOT NULL,
    target_resolution VARCHAR(20) NOT NULL,
    target_format VARCHAR(10) NOT NULL,
    quality_preset VARCHAR(20) DEFAULT 'medium',
    bitrate VARCHAR(10) DEFAULT '1000k',
    repeat_count INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending',
    output_path VARCHAR(500),
    output_storage_key VARCHAR(255),
    storage_key VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    processing_time_seconds INTEGER
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_transcode_jobs_user_id ON transcode_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_transcode_jobs_video_id ON transcode_jobs(video_id);
CREATE INDEX IF NOT EXISTS idx_transcode_jobs_status ON transcode_jobs(status);

-- Insert default users with hashed passwords and consistent UUIDs
-- Note: These passwords are hashed with bcrypt rounds=10 for "password"
-- Using consistent UUIDs to match JWT tokens from SQLite migration
INSERT INTO users (id, username, password_hash, role) VALUES
    ('5f91b320-7de6-48e1-a1d5-6ed3c04b1d08', 'user1', '$2b$10$GsoEAmMHwht0U3bpBX.SbeVoax0eyOBPNlZv88Wo4I70L32XjG4pu', 'user'),
    ('a8d2c4e6-1b3f-4567-8901-234567890abc', 'admin1', '$2b$10$GsoEAmMHwht0U3bpBX.SbeVoax0eyOBPNlZv88Wo4I70L32XjG4pu', 'admin'),
    ('b9e3d5f7-2c4f-5678-9012-345678901bcd', 'user2', '$2b$10$GsoEAmMHwht0U3bpBX.SbeVoax0eyOBPNlZv88Wo4I70L32XjG4pu', 'user')
ON CONFLICT (username) DO NOTHING;