const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Department = require('../models/Department');
const Assignment = require('../models/Assignment');

dotenv.config();

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/academic';

async function run() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to Mongo for seeding');

  // Clear collections (CAUTION: for dev only)
  await User.deleteMany({});
  await Department.deleteMany({});
  await Assignment.deleteMany({});

  const pwd = await bcrypt.hash('password123', 10);

  const admin = await User.create({ name: 'HOD Admin', email: 'hod@example.com', password: pwd, role: 'admin', department: 'ECE' });
  const faculty = await User.create({ name: 'Prof Alice', email: 'alice@example.com', password: pwd, role: 'faculty', department: 'ECE' });
  const student1 = await User.create({ name: 'Bob Student', email: 'bob@example.com', password: pwd, role: 'student', department: 'ECE', year: 2, section: 'A' });
  const student2 = await User.create({ name: 'Eve Student', email: 'eve@example.com', password: pwd, role: 'student', department: 'ECE', year: 2, section: 'A' });

  const dept = await Department.create({ name: 'ECE', subjects: ['DSA','OS'], sections: ['A','B'], materials: [] });

  const asg = await Assignment.create({ title: 'Assignment 1', description: 'Solve problems', department: 'ECE', year: 2, section: 'A', subject: 'DSA', dueDate: new Date(Date.now()+7*24*3600*1000), createdBy: faculty._id });

  console.log('Seed complete:');
  console.log({ admin: admin.email, faculty: faculty.email, students: [student1.email, student2.email], assignmentId: asg._id });
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
