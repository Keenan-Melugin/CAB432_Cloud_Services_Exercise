// Storage abstraction layer - Phase 1 implementation
// This module provides a unified interface for file storage operations
// Initially implements local file system, easily extensible to S3

const fs = require('fs').promises;
const path = require('path');

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

  // S3 implementation placeholders (Phase 2)
  async _uploadS3(buffer, filename, metadata) {
    // TODO: Implement S3 upload using AWS SDK
    throw new Error('S3 implementation not yet available');
  }

  async _downloadS3(key) {
    // TODO: Implement S3 download using AWS SDK
    throw new Error('S3 implementation not yet available');
  }

  async _deleteS3(key) {
    // TODO: Implement S3 delete using AWS SDK
    throw new Error('S3 implementation not yet available');
  }

  async _getS3Url(key, expiresIn) {
    // TODO: Implement S3 presigned URL generation
    throw new Error('S3 implementation not yet available');
  }
}

// Export singleton instance
const storage = new StorageProvider({
  provider: process.env.STORAGE_PROVIDER || 'local'
});

module.exports = storage;