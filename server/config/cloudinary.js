const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
dotenv.config();

console.log('🔧 Configuring Cloudinary...');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? '✓ Set' : '❌ NOT SET');
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '✓ Set' : '❌ NOT SET');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '❌ NOT SET');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('Cloudinary configured:', cloudinary.config().cloud_name ? '✓' : '❌');

const streamifier = require('streamifier');

// Upload a buffer to Cloudinary with retry logic.
async function uploadBuffer(buffer, options = {}, maxRetries = 2, retryDelayMs = 300) {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
        streamifier.createReadStream(buffer).pipe(stream);
      });
      return result;
    } catch (err) {
      if (attempt > maxRetries) throw err;
      // simple backoff
      await new Promise(r => setTimeout(r, retryDelayMs));
    }
  }
}

module.exports = { cloudinary, uploadBuffer };
