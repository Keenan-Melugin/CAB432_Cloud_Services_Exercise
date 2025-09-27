#!/usr/bin/env node

// Cleanup script for S3 buckets and DynamoDB tables
// This script will remove ALL data from S3 buckets and DynamoDB tables

const { s3Client, buckets } = require('./utils/aws-config');
const { docClient, tableNames } = require('./utils/dynamodb-config');
const { ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const readline = require('readline');

class DataCleanup {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.skipConfirmation = options.skipConfirmation || false;
  }

  // Create readline interface for user input
  createReadlineInterface() {
    return readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // Ask user for confirmation
  async askConfirmation(message) {
    if (this.skipConfirmation) return true;

    const rl = this.createReadlineInterface();

    return new Promise((resolve) => {
      rl.question(`${message} (yes/no): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
  }

  // Clean up S3 bucket
  async cleanupS3Bucket(bucketName) {
    console.log(`\n🧹 Cleaning S3 bucket: ${bucketName}`);

    try {
      // List all objects in the bucket
      let continuationToken;
      let totalObjects = 0;

      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: bucketName,
          ContinuationToken: continuationToken
        });

        const listResponse = await s3Client.send(listCommand);
        const objects = listResponse.Contents || [];

        if (objects.length === 0) {
          console.log(`  ✅ Bucket ${bucketName} is already empty`);
          break;
        }

        console.log(`  📄 Found ${objects.length} objects to delete`);
        totalObjects += objects.length;

        if (this.dryRun) {
          console.log(`  🔍 [DRY RUN] Would delete ${objects.length} objects:`);
          objects.slice(0, 5).forEach(obj => console.log(`    - ${obj.Key}`));
          if (objects.length > 5) console.log(`    ... and ${objects.length - 5} more`);
        } else {
          // Delete objects in batches
          const deleteParams = {
            Bucket: bucketName,
            Delete: {
              Objects: objects.map(obj => ({ Key: obj.Key }))
            }
          };

          const deleteCommand = new DeleteObjectsCommand(deleteParams);
          const deleteResponse = await s3Client.send(deleteCommand);

          console.log(`  ✅ Deleted ${deleteResponse.Deleted?.length || 0} objects`);

          if (deleteResponse.Errors?.length > 0) {
            console.log(`  ⚠️  ${deleteResponse.Errors.length} deletion errors:`);
            deleteResponse.Errors.forEach(error =>
              console.log(`    - ${error.Key}: ${error.Message}`)
            );
          }
        }

        continuationToken = listResponse.NextContinuationToken;
      } while (continuationToken);

      console.log(`  🎯 Total objects processed: ${totalObjects}`);

    } catch (error) {
      if (error.name === 'NoSuchBucket') {
        console.log(`  ℹ️  Bucket ${bucketName} does not exist`);
      } else {
        console.error(`  ❌ Error cleaning bucket ${bucketName}:`, error.message);
        throw error;
      }
    }
  }

  // Clean up DynamoDB table
  async cleanupDynamoDBTable(tableName) {
    console.log(`\n🧹 Cleaning DynamoDB table: ${tableName}`);

    try {
      // Scan all items in the table
      let lastEvaluatedKey;
      let totalItems = 0;

      do {
        const scanCommand = new ScanCommand({
          TableName: tableName,
          ExclusiveStartKey: lastEvaluatedKey,
          ProjectionExpression: 'id' // Only get the primary key
        });

        const scanResponse = await docClient.send(scanCommand);
        const items = scanResponse.Items || [];

        if (items.length === 0) {
          console.log(`  ✅ Table ${tableName} is already empty`);
          break;
        }

        console.log(`  📄 Found ${items.length} items to delete`);
        totalItems += items.length;

        if (this.dryRun) {
          console.log(`  🔍 [DRY RUN] Would delete ${items.length} items:`);
          items.slice(0, 3).forEach(item => console.log(`    - ID: ${item.id}`));
          if (items.length > 3) console.log(`    ... and ${items.length - 3} more`);
        } else {
          // Delete items one by one (DynamoDB doesn't have batch delete)
          let deletedCount = 0;
          for (const item of items) {
            try {
              const deleteCommand = new DeleteCommand({
                TableName: tableName,
                Key: { id: item.id }
              });
              await docClient.send(deleteCommand);
              deletedCount++;
            } catch (deleteError) {
              console.log(`    ⚠️  Failed to delete item ${item.id}: ${deleteError.message}`);
            }
          }
          console.log(`  ✅ Deleted ${deletedCount}/${items.length} items`);
        }

        lastEvaluatedKey = scanResponse.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      console.log(`  🎯 Total items processed: ${totalItems}`);

    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(`  ℹ️  Table ${tableName} does not exist`);
      } else {
        console.error(`  ❌ Error cleaning table ${tableName}:`, error.message);
        throw error;
      }
    }
  }

  // Main cleanup function
  async cleanup() {
    console.log('🧹 Video Transcoder Data Cleanup Script');
    console.log('=====================================');

    if (this.dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be deleted');
    } else {
      console.log('⚠️  LIVE MODE - Data will be permanently deleted');
    }

    console.log('\nTarget Resources:');
    console.log('📦 S3 Buckets:');
    console.log(`  - ${buckets.original} (original videos)`);
    console.log(`  - ${buckets.processed} (processed videos)`);

    console.log('🗃️  DynamoDB Tables:');
    Object.entries(tableNames).forEach(([key, tableName]) => {
      console.log(`  - ${tableName} (${key})`);
    });

    // Safety confirmation
    if (!this.dryRun) {
      const confirmed = await this.askConfirmation(
        '\n⚠️  This will permanently delete ALL videos and database records. Are you sure?'
      );

      if (!confirmed) {
        console.log('❌ Cleanup cancelled by user');
        return;
      }

      const doubleConfirmed = await this.askConfirmation(
        'Are you absolutely certain? This action cannot be undone'
      );

      if (!doubleConfirmed) {
        console.log('❌ Cleanup cancelled by user');
        return;
      }
    }

    console.log('\n🚀 Starting cleanup...');

    try {
      // Clean S3 buckets
      console.log('\n📦 Cleaning S3 Buckets...');
      await this.cleanupS3Bucket(buckets.original);
      await this.cleanupS3Bucket(buckets.processed);

      // Clean DynamoDB tables
      console.log('\n🗃️  Cleaning DynamoDB Tables...');
      for (const [key, tableName] of Object.entries(tableNames)) {
        await this.cleanupDynamoDBTable(tableName);
      }

      console.log('\n✅ Cleanup completed successfully!');

      if (this.dryRun) {
        console.log('🔍 This was a dry run - no data was actually deleted');
        console.log('💡 Run with --live to perform actual cleanup');
      } else {
        console.log('🎯 All video files and database records have been removed');
      }

    } catch (error) {
      console.error('\n❌ Cleanup failed:', error.message);
      process.exit(1);
    }
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--live');
  const skipConfirmation = args.includes('--yes');

  const cleanup = new DataCleanup({
    dryRun,
    skipConfirmation
  });

  await cleanup.cleanup();
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = DataCleanup;