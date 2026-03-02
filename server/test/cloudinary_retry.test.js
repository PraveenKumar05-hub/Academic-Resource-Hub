const { expect } = require('chai');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { app, connectMongo } = require('../index');
const User = require('../models/User');
const Department = require('../models/Department');

describe('Cloudinary retry behavior', function(){
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

  it('retries on transient cloudinary error and succeeds', async ()=>{
    // create faculty
    const pwd = await bcrypt.hash('facx',8);
    await User.create({ name:'Fac X', email:'facx@test', password:pwd, role:'faculty', department:'CSE' });
    const login = await request(app).post('/api/auth/login').send({ email:'facx@test', password:'facx' }).expect(200);
    const token = login.body.token;

    // monkeypatch cloudinary uploader to fail once then succeed
    const cfg = require('../config/cloudinary');
    let calls = 0;
    const original = cfg.cloudinary.uploader.upload_stream;
    cfg.cloudinary.uploader.upload_stream = function(options, cb){
      calls++;
      const { PassThrough } = require('stream');
      const stream = new PassThrough();
      process.nextTick(()=>{
        if (calls === 1) return cb(new Error('transient error'));
        return cb(null, { secure_url: 'https://cdn.test/retried.pdf' });
      });
      return stream;
    };

    const res = await request(app)
      .post('/api/materials/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('title','Retry Test')
      .field('subject','DSA')
      .field('departmentName','CSE')
      .field('year','2')
      .field('section','A')
      .attach('file', Buffer.from('retry data'), 'retry.pdf')
      .expect(200);

    expect(res.body.url).to.include('https://cdn.test/retried.pdf');
    // cleanup: restore original
    cfg.cloudinary.uploader.upload_stream = original;
  });

  it('fails after exhausting retries', async ()=>{
    // create faculty
    const pwd = await bcrypt.hash('facy',8);
    await User.create({ name:'Fac Y', email:'facy@test', password:pwd, role:'faculty', department:'CSE' });
    const login = await request(app).post('/api/auth/login').send({ email:'facy@test', password:'facy' }).expect(200);
    const token = login.body.token;

    const cfg = require('../config/cloudinary');
    // make uploader always fail
    const original = cfg.cloudinary.uploader.upload_stream;
    cfg.cloudinary.uploader.upload_stream = function(options, cb){
      const { PassThrough } = require('stream');
      const stream = new PassThrough();
      process.nextTick(()=> cb(new Error('permanent error')));
      return stream;
    };

    // Now expect the upload endpoint to return 500
    await request(app)
      .post('/api/materials/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('title','Fail Test')
      .field('subject','OS')
      .field('departmentName','CSE')
      .field('year','2')
      .field('section','A')
      .attach('file', Buffer.from('bad data'), 'bad.pdf')
      .expect(500);

    cfg.cloudinary.uploader.upload_stream = original;
  });
});
