/**
 * Test Cloudinary URLs accessibility
 * Run: node server/test-urls.js
 */

const axios = require('axios');
const mongoose = require('mongoose');
const Department = require('./models/Department');
const dotenv = require('dotenv');

dotenv.config();

async function testUrls() {
  console.log('\n🧪 Testing Cloudinary URLs\n');
  console.log('='.repeat(60));

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/academic');

    // Get all departments with materials
    const departments = await Department.find().select('+materials');
    
    for (let dept of departments) {
      if (!dept.materials || dept.materials.length === 0) continue;
      
      console.log(`\n📁 Department: ${dept.name}`);
      console.log('-'.repeat(60));

      for (let material of dept.materials) {
        if (!material.url) {
          console.log(`\n❌ "${material.title}" - NO URL STORED`);
          continue;
        }

        console.log(`\n📄 "${material.title}"`);
        console.log(`   URL: ${material.url}`);
        console.log(`   File: ${material.filename}`);

        try {
          // Test if URL is accessible
          console.log('   Testing access...');
          const response = await axios.head(material.url, { timeout: 5000 });
          
          console.log(`   ✅ Accessible (HTTP ${response.status})`);
          console.log(`   Content-Type: ${response.headers['content-type']}`);
          console.log(`   Content-Length: ${response.headers['content-length'] || 'unknown'} bytes`);
          
        } catch (error) {
          console.log(`   ❌ NOT Accessible`);
          if (error.response) {
            console.log(`   HTTP ${error.response.status}: ${error.response.statusText}`);
          } else {
            console.log(`   Error: ${error.message}`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ URL test complete\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

testUrls();
