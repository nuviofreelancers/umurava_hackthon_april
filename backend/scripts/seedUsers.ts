import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('🌱 Connecting to MongoDB...');

    // Clear only demo accounts to avoid messing with real data
    const demoEmails = [
      'admin@hackathon.dev',
      'hr@hackathon.dev',
      'recruiter@hackathon.dev',
      'member4@hackathon.dev' // 🆕 4th team member
    ];
    await User.deleteMany({ email: { $in: demoEmails } });

    const demoUsers = [
      { full_name: 'Admin Demo', email: 'admin@hackathon.dev', password: 'AdminPass123', role: 'admin' },
      { full_name: 'M_1', email: 'hr@hackathon.dev', password: 'HRPass123', role: 'hr' },
      { full_name: 'M_2', email: 'member3@hackathon.dev', password: 'RecruiterPass123', role: 'hr' },
      { full_name: 'M_4', email: 'member4@hackathon.dev', password: 'TeamPass123', role: 'hr' }
    ];

    // Hash passwords & create users
    for (const userData of demoUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      await User.create({ ...userData, password: hashedPassword });
      console.log(`✅ Created: ${userData.email} (${userData.role})`);
    }

    console.log('\n🔑 Team Login Credentials:');
    demoUsers.forEach(u => console.log(`   ${u.email} / ${u.password}`));
    console.log('✅ Seeding complete!');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedUsers();