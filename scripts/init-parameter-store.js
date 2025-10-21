#!/usr/bin/env node

// Script to initialize Parameter Store with application configuration
const parameterStore = require('../utils/parameter-store');

async function initializeParameterStore() {
  console.log('Initializing AWS Parameter Store...');

  try {
    // Initialize parameters
    const success = await parameterStore.initializeParameters();

    if (success) {
      console.log('Parameter Store initialization completed successfully');

      // Test retrieval
      console.log('\nTesting parameter retrieval...');
      const config = await parameterStore.getAppConfig();
      console.log('Retrieved configuration:', JSON.stringify(config, null, 2));

      console.log('\nParameter Store is ready for use!');
      console.log('Your application will now use these centralized configuration values.');
    } else {
      console.log('Parameter Store initialization failed');
      process.exit(1);
    }

  } catch (error) {
    console.error('Error during Parameter Store initialization:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure AWS credentials are properly configured');
    console.error('2. Verify IAM permissions for SSM Parameter Store');
    console.error('3. Check AWS region configuration');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  initializeParameterStore();
}

module.exports = { initializeParameterStore };