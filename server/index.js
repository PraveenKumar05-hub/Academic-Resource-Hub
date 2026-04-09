const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/arh';

// Connect when run directly; tests will connect to their own DB.
async function connectMongo(uri) {
  const mongoUri = uri || MONGO;
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Mongo connected to', mongoUri);
}

// Routes
console.log('📡 Registering routes...');
app.use('/api/auth', require('./routes/auth'));
console.log('✓ Auth routes registered');

app.use('/api/materials', require('./routes/materials'));
console.log('✓ Materials routes registered');

app.use('/api/assignments', require('./routes/assignments'));
console.log('✓ Assignments routes registered');

app.use('/api/tests', require('./routes/tests'));
console.log('✓ Tests routes registered');

app.use('/api/notifications', require('./routes/notifications'));
console.log('✓ Notifications routes registered');

app.use('/api/admin', require('./routes/admin'));
console.log('✓ Admin routes registered');

app.use('/api/activity-logs', require('./routes/activityLogs'));
console.log('✓ Activity logs routes registered');

app.use('/api/departments', require('./routes/departments'));
console.log('✓ Departments routes registered');

// Test endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running ✓',
    timestamp: new Date().toISOString()
  });
});

// Diagnostic endpoint
app.get('/api/diagnostic', (req, res) => {
  const cloudConfig = {
    cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✓ Set' : '❌ NOT SET',
    cloudinary_api_key: process.env.CLOUDINARY_API_KEY ? '✓ Set' : '❌ NOT SET',
    cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '❌ NOT SET',
    mongo_uri: process.env.MONGO_URI ? '✓ Set' : 'Using default (localhost)',
    jwt_secret: process.env.JWT_SECRET ? '✓ Set' : 'Using default',
    smtp_host: process.env.SMTP_HOST ? '✓ Set' : '❌ NOT SET',
    smtp_user: process.env.SMTP_USER ? '✓ Set' : '❌ NOT SET',
    smtp_pass: process.env.SMTP_PASS ? '✓ Set' : '❌ NOT SET',
    smtp_from: process.env.SMTP_FROM ? '✓ Set' : 'Using SMTP_USER',
  };
  
  res.json({
    server: 'Running ✓',
    note: 'If Cloudinary fields show NOT SET, add them to .env file',
    config: cloudConfig
  });
});

console.log('✓ Health check route registered');


// Export app and helper to start server
module.exports = { app, connectMongo };

// If run directly, connect to default mongo and start server
if (require.main === module) {
  (async () => {
    try {
      await connectMongo();
      // Start cron jobs
      require('./cron/reminders')();
      const PORT = process.env.PORT || 5000;
      const server = app.listen(PORT, () => console.log('Server running on port', PORT));

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${PORT} is already in use. Stop the existing server process or set a different PORT value.`);
          process.exit(1);
        }

        console.error('Server listen error', err);
        process.exit(1);
      });
    } catch (err) {
      console.error('Startup error', err);
      process.exit(1);
    }
  })();
}
