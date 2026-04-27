import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './src/modules/users/user.model.js';
import { env } from './src/config/env.js';

async function resetAdmin() {
  await mongoose.connect(env.MONGODB_URI);
  const hash = await bcrypt.hash('Admin123', 12);
  await User.findOneAndUpdate({ email: 'gowdamchethan863@gmail.com' }, { passwordHash: hash });
  console.log('Admin password reset to Admin123');
  process.exit(0);
}

resetAdmin();
