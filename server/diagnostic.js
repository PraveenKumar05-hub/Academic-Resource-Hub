#!/usr/bin/env node

/**
 * Quick diagnostic script to test materials endpoint
 * Run from server directory: node diagnostic.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function runDiagnostics() {
  console.log('\n🔍 Academic Resource Hub - Diagnostic Report\n');
  console.log('================================================\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣  Testing Server Health...');
    try {
      const health = await axios.get(`${BASE_URL}/health`);
      console.log('   ✅ Server is running');
      console.log(`   Status: ${health.data.status}`);
    } catch (error) {
      console.log('   ❌ Server not responding');
      console.log('   Make sure server is running on port 5000');
      return;
    }

    // Test 2: Configuration Check
    console.log('\n2️⃣  Checking Configuration...');
    try {
      const diagnostic = await axios.get(`${BASE_URL}/diagnostic`);
      console.log('   Environment Variables:');
      Object.entries(diagnostic.data.config).forEach(([key, value]) => {
        const icon = value.includes('✓') ? '✅' : '⚠️ ';
        console.log(`     ${icon} ${key}: ${value}`);
      });
    } catch (error) {
      console.log('   ❌ Could not get configuration');
    }

    // Test 3: Materials Route
    console.log('\n3️⃣  Testing Materials Route...');
    try {
      const test = await axios.get(`${BASE_URL}/materials/test`);
      console.log('   ✅ Materials route is registered');
      console.log(`   Message: ${test.data.message}`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('   ❌ Materials route NOT found (404)');
      } else {
        console.log('   ❌ Error:', error.message);
      }
    }

    console.log('\n================================================');
    console.log('✅ Diagnostics complete\n');

  } catch (error) {
    console.error('❌ Diagnostic error:', error.message);
  }
}

runDiagnostics();
