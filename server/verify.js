/**
 * Quick verification script to test materials upload and database
 * Run this: node server/verify.js
 */

const mongoose = require('mongoose');
const Department = require('./models/Department');
const dotenv = require('dotenv');

dotenv.config();

async function verify() {
  console.log('\n🔍 Verification Report\n');
  console.log('='.repeat(50));

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/academic');
    console.log('✅ Connected to MongoDB\n');

    // Get all departments
    console.log('📂 Checking Departments...');
    const departments = await Department.find();
    console.log(`   Found ${departments.length} departments\n`);

    // List all materials
    console.log('📄 All Materials in Database:');
    console.log('-'.repeat(50));

    let totalMaterials = 0;
    departments.forEach(dept => {
      if (dept.materials && dept.materials.length > 0) {
        console.log(`\n  📁 Department: ${dept.name}`);
        console.log(`     Materials: ${dept.materials.length}`);
        
        dept.materials.forEach((material, idx) => {
          totalMaterials++;
          console.log(`\n     ${idx + 1}. "${material.title}"`);
          console.log(`        Subject: ${material.subject}`);
          console.log(`        Year: ${material.year}, Section: ${material.section}`);
          console.log(`        URL: ${material.url ? '✅ Present' : '❌ MISSING'}`);
          if (material.url) {
            console.log(`        URL (first 80 chars): ${material.url.substring(0, 80)}...`);
          }
          console.log(`        File: ${material.filename}`);
          console.log(`        Created: ${material.createdAt ? new Date(material.createdAt).toLocaleString() : 'N/A'}`);
        });
      }
    });

    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Summary: ${totalMaterials} total materials across ${departments.length} departments`);

    if (totalMaterials === 0) {
      console.log('\n⚠️  No materials found! Did uploads complete successfully?');
    }

    // Check for materials with missing URLs
    let missingUrls = 0;
    departments.forEach(dept => {
      if (dept.materials) {
        dept.materials.forEach(m => {
          if (!m.url) missingUrls++;
        });
      }
    });

    if (missingUrls > 0) {
      console.log(`\n❌ WARNING: ${missingUrls} materials have missing URLs!`);
      console.log('   This could be why files cannot open.');
    } else if (totalMaterials > 0) {
      console.log('\n✅ All materials have valid URLs');
    }

    // Cloudinary config check
    console.log('\n🔧 Cloudinary Configuration:');
    console.log(`   Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ NOT SET'}`);
    console.log(`   API Key: ${process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ NOT SET'}`);
    console.log(`   API Secret: ${process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ NOT SET'}`);

    console.log('\n' + '='.repeat(50) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

verify();
