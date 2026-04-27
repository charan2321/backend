import mongoose from 'mongoose';
import { User } from './src/modules/users/user.model.js';
import { env } from './src/config/env.js';

async function checkAdmins() {
  await mongoose.connect(env.MONGODB_URI);
  const admins = await User.find({ role: 'admin' });
  console.log('Admins found:', admins.map(a => a.email));
  process.exit(0);
}

checkAdmins();
