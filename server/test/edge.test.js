const { expect } = require('chai');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { app, connectMongo } = require('../index');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Assignment = require('../models/Assignment');

describe('Edge & error flows', function(){
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

  it('invalid login returns 400', async ()=>{
    await request(app).post('/api/auth/login').send({ email:'noone', password:'x' }).expect(400);
  });

  it('creating user with existing email returns 400', async ()=>{
    const hash = await bcrypt.hash('p',8);
    await User.create({ name:'X', email:'dup@test', password:hash, role:'admin' });
    // create via register route which also rejects duplicates
    const res = await request(app).post('/api/auth/register').send({ name:'Y', email:'dup@test', password:'p', role:'student' }).expect(400);
    expect(res.body).to.have.property('message');
  });

  it('non-admin cannot access admin routes', async ()=>{
    // create student user
    const hash = await bcrypt.hash('sp',8);
    await User.create({ name:'S', email:'s@test', password:hash, role:'student', department:'CSE', year:2, section:'A', batch:'2024-2028' });
    const login = await request(app).post('/api/auth/login').send({ email:'s@test', password:'sp' }).expect(200);
    const token = login.body.token;
    await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`).expect(403);
  });

  it('materials upload missing required fields returns 400', async ()=>{
    // create faculty and login
    const hash = await bcrypt.hash('fp2',8);
    await User.create({ name:'F2', email:'f2@test', password:hash, role:'faculty', department:'CSE' });
    const login = await request(app).post('/api/auth/login').send({ email:'f2@test', password:'fp2' }).expect(200);
    const token = login.body.token;
    // missing title + departmentName
    const res = await request(app)
      .post('/api/materials/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('subject', 'DSA')
      .field('year', '2')
      .field('section', 'A')
      .attach('file', Buffer.from('dummy data'), 'edge.pdf')
      .expect(400);
    expect(res.body).to.have.property('message');
  });

  it('duplicate acknowledgement returns 400', async ()=>{
    // create admin, faculty, student, create assignment, ack twice
    const ah = await bcrypt.hash('ap',8);
    const admin = await User.create({ name:'A', email:'a@test', password:ah, role:'admin', department:'CSE' });
    const adminLogin = await request(app).post('/api/auth/login').send({ email:'a@test', password:'ap' }).expect(200);
    const adminToken = adminLogin.body.token;

    const facHash = await bcrypt.hash('fp3',8);
    await User.create({ name:'F3', email:'f3@test', password:facHash, role:'faculty', department:'CSE' });
    const facLogin = await request(app).post('/api/auth/login').send({ email:'f3@test', password:'fp3' }).expect(200);
    const facToken = facLogin.body.token;

    const faculty = await User.findOne({ email: 'f3@test' })
    const createdAssignment = await Assignment.create({
      title: 'Edge Asg',
      department: 'CSE',
      year: 2,
      section: 'A',
      subject: 'DSA',
      dueDate: new Date(),
      createdBy: faculty._id
    })
    const asgId = createdAssignment._id.toString();

    // admin creates student
    await request(app).post('/api/admin/users').set('Authorization', `Bearer ${adminToken}`).send({ name:'S1', email:'s1@test', password:'sp', role:'student', department:'CSE', year:2, section:'A', batch:'2024-2028' }).expect(201);
    const stLogin = await request(app).post('/api/auth/login').send({ email:'s1@test', password:'sp' }).expect(200);
    const stToken = stLogin.body.token;

    await request(app).post(`/api/assignments/${asgId}/acknowledge`).set('Authorization', `Bearer ${stToken}`).send({ method:'online' }).expect(200);
    // second ack should fail
    await request(app).post(`/api/assignments/${asgId}/acknowledge`).set('Authorization', `Bearer ${stToken}`).send({ method:'online' }).expect(400);
  });

  it('cannot mark another user\'s notification as read (404)', async ()=>{
    // create two students and a notification for one
    const h = await bcrypt.hash('p1',8);
    await User.create({ name:'U1', email:'u1@test', password:h, role:'student', department:'CSE', year:2, section:'A' });
    await User.create({ name:'U2', email:'u2@test', password:h, role:'student', department:'CSE', year:2, section:'A' });
    const nFor = await request(app).post('/api/auth/login').send({ email:'u1@test', password:'p1' }).expect(200);
    const user1Token = nFor.body.token;
    // create notification directly
    const user = await User.findOne({ email:'u1@test' });
    const note = await Notification.create({ user: user._id, title: 'Test', message: 'Test note', type: 'info' });

    const login2 = await request(app).post('/api/auth/login').send({ email:'u2@test', password:'p1' }).expect(200);
    const user2Token = login2.body.token;
    // user2 trying to mark user1's notification -> 404
    await request(app).post(`/api/notifications/${note._id}/read`).set('Authorization', `Bearer ${user2Token}`).expect(404);
  });

  it('materials upload requires auth (401)', async ()=>{
    // post without token
    await request(app).post('/api/materials/upload').expect(401);
  });
});
