// AWS Parameter Store service
const { SSMClient, GetParameterCommand, GetParametersCommand, PutParameterCommand } = require('@aws-sdk/client-ssm');

class ParameterStoreService {
  constructor() {
    this.client = new SSMClient({
      region: process.env.AWS_REGION || 'ap-southeast-2'
    });

    // Parameter naming convention: /n10992511/videotranscoder/{environment}/{parameter}
    this.parameterPrefix = process.env.PARAMETER_PREFIX || '/n10992511/videotranscoder/dev';
  }

  // Get a single parameter
  async getParameter(name, decrypt = false) {
    try {
      const parameterName = `${this.parameterPrefix}/${name}`;
      const command = new GetParameterCommand({
        Name: parameterName,
        WithDecryption: decrypt
      });

      const response = await this.client.send(command);
      return response.Parameter?.Value || null;
    } catch (error) {
      if (error.name === 'ParameterNotFound') {
        console.warn(`Parameter not found: ${name}`);
        return null;
      }
      throw new Error(`Failed to get parameter ${name}: ${error.message}`);
    }
  }

  // Get multiple parameters at once
  async getParameters(names, decrypt = false) {
    try {
      const parameterNames = names.map(name => `${this.parameterPrefix}/${name}`);
      const command = new GetParametersCommand({
        Names: parameterNames,
        WithDecryption: decrypt
      });

      const response = await this.client.send(command);
      const result = {};

      // Map results back to original names
      response.Parameters?.forEach(param => {
        const originalName = param.Name.replace(`${this.parameterPrefix}/`, '');
        result[originalName] = param.Value;
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to get parameters: ${error.message}`);
    }
  }

  // Set a parameter (useful for initial setup)
  async setParameter(name, value, description = '', type = 'String') {
    try {
      const parameterName = `${this.parameterPrefix}/${name}`;
      const command = new PutParameterCommand({
        Name: parameterName,
        Value: value,
        Type: type,
        Description: description,
        Overwrite: true,
        Tags: [
          { Key: 'Application', Value: 'VideoTranscoder' },
          { Key: 'Environment', Value: 'Development' },
          { Key: 'Owner', Value: 'n10992511' },
          { Key: 'qut-username', Value: 'n10992511@qut.edu.au' }
        ]
      });

      await this.client.send(command);
      console.log(`Parameter set: ${name} = ${value}`);
      return true;
    } catch (error) {
      throw new Error(`Failed to set parameter ${name}: ${error.message}`);
    }
  }

  // Get application configuration from Parameter Store
  async getAppConfig() {
    try {
      const configParams = [
        'app/base_url',
        's3/original_bucket',
        's3/processed_bucket',
        'dynamodb/table_prefix',
        'transcoding/default_quality',
        'transcoding/supported_formats'
      ];

      const config = await this.getParameters(configParams);

      // Provide fallbacks for missing parameters
      return {
        baseUrl: config['app/base_url'] || process.env.BASE_URL || 'http://localhost:3000',
        s3OriginalBucket: config['s3/original_bucket'] || process.env.S3_ORIGINAL_BUCKET || 'n10992511-videotranscoder-original',
        s3ProcessedBucket: config['s3/processed_bucket'] || process.env.S3_PROCESSED_BUCKET || 'n10992511-videotranscoder-processed',
        dynamoTablePrefix: config['dynamodb/table_prefix'] || process.env.DYNAMODB_TABLE_PREFIX || 'videotranscoder',
        defaultQuality: config['transcoding/default_quality'] || 'medium',
        supportedFormats: config['transcoding/supported_formats'] || 'mp4,webm,mov,avi'
      };
    } catch (error) {
      console.warn('Failed to load configuration from Parameter Store, using environment variables:', error.message);

      // Fallback to environment variables
      return {
        baseUrl: process.env.BASE_URL || 'http://localhost:3000',
        s3OriginalBucket: process.env.S3_ORIGINAL_BUCKET || 'n10992511-videotranscoder-original',
        s3ProcessedBucket: process.env.S3_PROCESSED_BUCKET || 'n10992511-videotranscoder-processed',
        dynamoTablePrefix: process.env.DYNAMODB_TABLE_PREFIX || 'videotranscoder',
        defaultQuality: 'medium',
        supportedFormats: 'mp4,webm,mov,avi'
      };
    }
  }

  // Initialize parameters with default values
  async initializeParameters() {
    try {
      console.log('Initializing Parameter Store with default values...');

      const defaultParams = [
        {
          name: 'app/base_url',
          value: process.env.BASE_URL || 'http://localhost:3000',
          description: 'Base URL for the video transcoding application'
        },
        {
          name: 's3/original_bucket',
          value: process.env.S3_ORIGINAL_BUCKET || 'n10992511-videotranscoder-original',
          description: 'S3 bucket for original video files'
        },
        {
          name: 's3/processed_bucket',
          value: process.env.S3_PROCESSED_BUCKET || 'n10992511-videotranscoder-processed',
          description: 'S3 bucket for processed video files'
        },
        {
          name: 'dynamodb/table_prefix',
          value: process.env.DYNAMODB_TABLE_PREFIX || 'videotranscoder',
          description: 'Prefix for DynamoDB table names'
        },
        {
          name: 'transcoding/default_quality',
          value: 'medium',
          description: 'Default quality preset for video transcoding (low, medium, high)'
        },
        {
          name: 'transcoding/supported_formats',
          value: 'mp4,webm,mov,avi,mkv',
          description: 'Comma-separated list of supported video formats'
        }
      ];

      for (const param of defaultParams) {
        await this.setParameter(param.name, param.value, param.description);
      }

      console.log('Parameter Store initialization completed');
      return true;
    } catch (error) {
      console.error('Failed to initialize Parameter Store:', error);
      return false;
    }
  }
}

// Export singleton instance
const parameterStore = new ParameterStoreService();
module.exports = parameterStore;