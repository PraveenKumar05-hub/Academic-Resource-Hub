const { expect } = require('chai');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { app, connectMongo } = require('../index');
const User = require('../models/User');
const Department = require('../models/Department');

describe('Materials upload (multipart) with Cloudinary mock', function(){
  this.timeout(10000);
  let mongoServer;

  before(async ()=>{
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await connectMongo(uri);
  });

  after(async ()=>{
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('uploads a file and saves material record', async ()=>{
    // create a faculty user
    const pwd = await bcrypt.hash('facpass', 8);
    await User.create({ name:'Fac M', email:'facm@test', password:pwd, role:'faculty', department:'CSE' });
    const login = await request(app).post('/api/auth/login').send({ email:'facm@test', password:'facpass' }).expect(200);
    const token = login.body.token;

    // Mock cloudinary uploader.upload_stream (config exports { cloudinary, uploadBuffer })
    const cfg = require('../config/cloudinary');
    // Replace uploader.upload_stream with a writable stream that calls callback with fake result
    const { PassThrough } = require('stream');
    const original = cfg.cloudinary.uploader.upload_stream;
    cfg.cloudinary.uploader.upload_stream = function(options, callback){
      const stream = new PassThrough();
      // simulate async upload result
      process.nextTick(()=> callback(null, { secure_url: 'https://cdn.test/fakefile.pdf' }));
      return stream;
    };

    // Perform multipart upload
    const res = await request(app)
      .post('/api/materials/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Test PPT')
      .field('subject', 'OS')
      .field('departmentName', 'CSE')
      .field('year', '2')
      .field('section', 'A')
      .attach('file', Buffer.from('dummy data'), 'test.pdf')
      .expect(200);

    expect(res.body).to.have.property('url').that.includes('https://cdn.test/');

    // Verify department material saved
    const dept = await Department.findOne({ name: 'CSE' });
    expect(dept).to.exist;
    expect(dept.materials).to.be.an('array').that.is.not.empty;
    const m = dept.materials.find(x => x.title === 'Test PPT' || x.filename === 'test.pdf');
    expect(m).to.exist;
    expect(m.url).to.equal('https://cdn.test/fakefile.pdf');
    // restore original uploader
    cfg.cloudinary.uploader.upload_stream = original;
  });
});
