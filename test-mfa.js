#!/usr/bin/env node

/**
 * MFA Testing Script for Video Transcoding Service
 * Tests all MFA endpoints and flows
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'mfatest@example.com';
const TEST_PASSWORD = 'TestPass123!';
const TEST_PHONE = '+1234567890';

let accessToken = null;

class MFATester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async test(name, testFunction) {
    console.log(`\n🧪 Testing: ${name}`);
    try {
      await testFunction();
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED' });
      console.log(`✅ ${name} - PASSED`);
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', error: error.message });
      console.log(`❌ ${name} - FAILED: ${error.message}`);
    }
  }

  async setupTestUser() {
    try {
      // Sign up test user
      await axios.post(`${BASE_URL}/auth/signup`, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });
      console.log('✅ Test user signup initiated');

      // Note: In real testing, you'd need to confirm the user
      console.log('ℹ️  You need to manually confirm the test user or use admin commands');

    } catch (error) {
      if (error.response?.data?.error === 'User already exists') {
        console.log('ℹ️  Test user already exists, continuing...');
      } else {
        throw error;
      }
    }
  }

  async loginTestUser() {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (response.data.requiresMFA) {
      throw new Error('MFA required for test user - please disable MFA for testing');
    }

    accessToken = response.data.accessToken;
    return response.data;
  }

  async testMFAStatus() {
    const response = await axios.get(`${BASE_URL}/auth/mfa/status`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (typeof response.data.mfaEnabled !== 'boolean') {
      throw new Error('MFA status endpoint should return mfaEnabled boolean');
    }
  }

  async testTOTPSetup() {
    const response = await axios.post(`${BASE_URL}/auth/mfa/setup/totp`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.data.secretCode) {
      throw new Error('TOTP setup should return secretCode');
    }

    if (!response.data.qrCodeData || !response.data.qrCodeData.includes('otpauth://')) {
      throw new Error('TOTP setup should return valid QR code data');
    }

    console.log('📱 TOTP Secret Code:', response.data.secretCode);
    console.log('📱 QR Code Data:', response.data.qrCodeData);
  }

  async testSMSSetup() {
    const response = await axios.post(`${BASE_URL}/auth/mfa/setup/sms`, {
      phoneNumber: TEST_PHONE
    }, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.data.message || !response.data.message.includes('SMS MFA setup completed')) {
      throw new Error('SMS setup should confirm completion');
    }

    if (!response.data.phoneNumber) {
      throw new Error('SMS setup should return masked phone number');
    }
  }

  async testMFADisable() {
    const response = await axios.post(`${BASE_URL}/auth/mfa/disable`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (response.data.mfaEnabled !== false) {
      throw new Error('MFA disable should set mfaEnabled to false');
    }
  }

  async testErrorHandling() {
    // Test with invalid access token
    try {
      await axios.get(`${BASE_URL}/auth/mfa/status`, {
        headers: { Authorization: `Bearer invalid_token` }
      });
      throw new Error('Should have failed with invalid token');
    } catch (error) {
      if (error.response?.status !== 403) {
        throw new Error('Should return 403 for invalid token');
      }
    }

    // Test TOTP setup without auth
    try {
      await axios.post(`${BASE_URL}/auth/mfa/setup/totp`);
      throw new Error('Should have failed without authentication');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error('Should return 401 for missing authentication');
      }
    }
  }

  async runAllTests() {
    console.log('🚀 Starting MFA Tests...\n');

    try {
      // Setup
      await this.test('Setup Test User', () => this.setupTestUser());
      await this.test('Login Test User', () => this.loginTestUser());

      // Core MFA Tests
      await this.test('MFA Status Check', () => this.testMFAStatus());
      await this.test('TOTP Setup', () => this.testTOTPSetup());
      await this.test('SMS Setup', () => this.testSMSSetup());
      await this.test('MFA Disable', () => this.testMFADisable());

      // Error Handling Tests
      await this.test('Error Handling', () => this.testErrorHandling());

    } catch (error) {
      console.error('\n💥 Test setup failed:', error.message);
    }

    // Results Summary
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(40));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          console.log(`   • ${test.name}: ${test.error}`);
        });
    }

    console.log('\n📝 Manual Testing Steps:');
    console.log('1. Use an authenticator app to scan the QR code from TOTP setup');
    console.log('2. Test the complete login flow with MFA enabled');
    console.log('3. Test MFA challenge with correct and incorrect codes');
    console.log('4. Verify SMS delivery (requires valid phone number and AWS SNS setup)');

    return this.results.failed === 0;
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new MFATester();

  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = MFATester;