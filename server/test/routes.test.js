const { expect } = require('chai');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { app, connectMongo } = require('../index');
const User = require('../models/User');
const Assignment = require('../models/Assignment');

describe('API routes (integration)', function(){
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

  let adminToken, facultyToken, studentToken, assignmentId;

  it('creates an admin user directly', async ()=>{
    const hash = await bcrypt.hash('testpass', 8);
    const admin = await User.create({ name:'ADM', email:'adm@test', password:hash, role:'admin', department:'ECE' });
    expect(admin).to.have.property('_id');
  });

  it('admin can login and receive token', async ()=>{
    const res = await request(app).post('/api/auth/login').send({ email:'adm@test', password:'testpass' }).expect(200);
    expect(res.body).to.have.property('token');
    adminToken = res.body.token;
  });

  it('admin can create a faculty user', async ()=>{
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name:'Prof T', email:'prof@test', password:'profpass', role:'faculty', department:'ECE' })
      .expect(201);
    expect(res.body.user).to.have.property('_id');
  });

  it('faculty can login', async ()=>{
    const res = await request(app).post('/api/auth/login').send({ email:'prof@test', password:'profpass' }).expect(200);
    facultyToken = res.body.token;
    expect(facultyToken).to.be.a('string');
  });

  it('faculty assignment appears in listing', async ()=>{
    const faculty = await User.findOne({ email: 'prof@test' })
    const assignment = await Assignment.create({
      title: 'Test Asg',
      description: 'desc',
      department: 'ECE',
      year: 2,
      section: 'A',
      subject: 'DSA',
      dueDate: new Date(),
      createdBy: faculty._id
    })

    assignmentId = assignment._id.toString()

    const res = await request(app)
      .get('/api/assignments')
      .set('Authorization', `Bearer ${facultyToken}`)
      .expect(200)

    expect(res.body.assignments).to.be.an('array')
    expect(res.body.assignments.some((a) => String(a._id) === assignmentId)).to.equal(true)
  });

  it('admin can create student and student can acknowledge', async ()=>{
    // create student
    const res1 = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name:'Stu T', email:'stu@test', password:'stupass', role:'student', department:'ECE', year:2, section:'A', batch:'2024-2028' })
      .expect(201);
    // student login
    const res2 = await request(app).post('/api/auth/login').send({ email:'stu@test', password:'stupass' }).expect(200);
    studentToken = res2.body.token;
    // student list assignments
    const list = await request(app).get('/api/assignments').set('Authorization', `Bearer ${studentToken}`).expect(200);
    expect(list.body.assignments).to.be.an('array');
    // acknowledge
    const ack = await request(app).post(`/api/assignments/${assignmentId}/acknowledge`).set('Authorization', `Bearer ${studentToken}`).send({ method:'online' }).expect(200);
    expect(ack.body.message).to.equal('Acknowledged successfully');
  });

  it('faculty can view acknowledgements', async ()=>{
    const res = await request(app).get(`/api/assignments/${assignmentId}/acknowledgements`).set('Authorization', `Bearer ${facultyToken}`).expect(200);
    expect(res.body.acknowledgements).to.be.an('array');
    expect(res.body.acknowledgements.length).to.equal(1);
  });
});
