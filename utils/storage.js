// Storage abstraction layer - S3-Only implementation
// This module provides S3-only file storage operations
const { s3Client, buckets } = require('./aws-config');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

class StorageProvider {
  constructor(config = {}) {
    this.provider = config.provider || 's3'; // Default to S3 instead of local
    this.config = config;

    // Force S3 provider - no local storage support
    if (this.provider !== 's3') {
      console.warn(`Storage provider '${this.provider}' not supported. Forcing S3 provider.`);
      this.provider = 's3';
    }
  }

  async uploadFile(buffer, filename, metadata = {}) {
    // Only S3 uploads are supported
    return this._uploadS3(buffer, filename, metadata);
  }

  async downloadFile(key) {
    // Only S3 downloads are supported
    return this._downloadS3(key);
  }

  async deleteFile(key) {
    // Only S3 deletes are supported
    return this._deleteS3(key);
  }

  async getFileUrl(key, expiresIn = 3600, bucketHint = null) {
    // Only S3 URLs are supported
    return this._getS3Url(key, expiresIn, bucketHint);
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

  async _getS3Url(key, expiresIn, bucketHint = null) {
    try {
      // Determine bucket based on hint, key content, or default to processed
      let bucket;
      if (bucketHint === 'original') {
        bucket = buckets.original;
      } else if (bucketHint === 'processed') {
        bucket = buckets.processed;
      } else {
        // Fallback: try to guess from key content
        bucket = key.includes('original') ? buckets.original : buckets.processed;
      }

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

// Export singleton instance - S3 only
const storage = new StorageProvider({
  provider: 's3' // Always use S3
});

module.exports = storage;