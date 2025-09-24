// Storage abstraction layer - Phase 1 implementation
// This module provides a unified interface for file storage operations
// Initially implements local file system, easily extensible to S3

const fs = require('fs').promises;
const path = require('path');
const { s3Client, buckets } = require('./aws-config');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

class StorageProvider {
  constructor(config = {}) {
    this.provider = config.provider || 'local';
    this.config = config;
  }

  async uploadFile(buffer, filename, metadata = {}) {
    switch (this.provider) {
      case 'local':
        return this._uploadLocal(buffer, filename, metadata);
      case 's3':
        return this._uploadS3(buffer, filename, metadata);
      default:
        throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }

  async downloadFile(key) {
    switch (this.provider) {
      case 'local':
        return this._downloadLocal(key);
      case 's3':
        return this._downloadS3(key);
      default:
        throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }

  async deleteFile(key) {
    switch (this.provider) {
      case 'local':
        return this._deleteLocal(key);
      case 's3':
        return this._deleteS3(key);
      default:
        throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }

  async getFileUrl(key, expiresIn = 3600) {
    switch (this.provider) {
      case 'local':
        return this._getLocalUrl(key);
      case 's3':
        return this._getS3Url(key, expiresIn);
      default:
        throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }

  // Local file system implementation (current)
  async _uploadLocal(buffer, filename, metadata) {
    const category = metadata.category || 'original';
    const uploadPath = path.join('uploads', category);
    const fullPath = path.join(uploadPath, filename);
    
    await fs.mkdir(uploadPath, { recursive: true });
    await fs.writeFile(fullPath, buffer);
    
    return {
      key: fullPath,
      location: fullPath,
      size: buffer.length
    };
  }

  async _downloadLocal(key) {
    const buffer = await fs.readFile(key);
    return {
      buffer,
      metadata: {
        size: buffer.length,
        lastModified: (await fs.stat(key)).mtime
      }
    };
  }

  async _deleteLocal(key) {
    await fs.unlink(key);
    return { deleted: true };
  }

  _getLocalUrl(key) {
    // Return local file path - in production this would be a proper URL
    return `file://${path.resolve(key)}`;
  }

  // S3 implementation
  async _uploadS3(buffer, filename, metadata) {
    try {
      const category = metadata.category || 'original';
      const bucket = category === 'original' ? buckets.original : buckets.processed;
      const key = `${uuidv4()}-${filename}`;

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: metadata.contentType || 'application/octet-stream',
        Metadata: {
          originalName: filename,
          category: category,
          uploadedAt: new Date().toISOString()
        }
      });

      const result = await s3Client.send(command);

      return {
        key: key,
        location: `s3://${bucket}/${key}`,
        size: buffer.length,
        bucket: bucket,
        etag: result.ETag
      };
    } catch (error) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  async _downloadS3(key) {
    try {
      // Determine which bucket based on key or metadata
      const bucket = key.includes('processed') ? buckets.processed : buckets.original;

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });

      const response = await s3Client.send(command);
      const buffer = await this._streamToBuffer(response.Body);

      return {
        buffer,
        metadata: {
          size: response.ContentLength,
          lastModified: response.LastModified,
          contentType: response.ContentType,
          etag: response.ETag
        }
      };
    } catch (error) {
      throw new Error(`S3 download failed: ${error.message}`);
    }
  }

  async _deleteS3(key) {
    try {
      // Try both buckets since we don't always know which one
      const bucketNames = [buckets.original, buckets.processed];

      for (const bucket of bucketNames) {
        try {
          const command = new DeleteObjectCommand({
            Bucket: bucket,
            Key: key
          });
          await s3Client.send(command);
          return { deleted: true, bucket: bucket };
        } catch (error) {
          // Continue to next bucket if not found
          if (error.name !== 'NoSuchKey') {
            throw error;
          }
        }
      }

      return { deleted: false, error: 'Key not found in any bucket' };
    } catch (error) {
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  async _getS3Url(key, expiresIn) {
    try {
      // Determine bucket based on key or default to processed for downloads
      const bucket = key.includes('original') ? buckets.original : buckets.processed;

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      throw new Error(`S3 presigned URL generation failed: ${error.message}`);
    }
  }

  // Helper method to convert stream to buffer
  async _streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}

// Export singleton instance
const storage = new StorageProvider({
  provider: process.env.STORAGE_PROVIDER || 'local'
});

module.exports = storage;