import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('🌱 Connecting to MongoDB...');

    const demoEmails = [
      'admin@hackathon.dev',
      'hr@hackathon.dev',
      'member3@hackathon.dev',
      'member4@hackathon.dev',
      'judge1@talentscreen.demo',
      'judge2@talentscreen.demo',
    ];
    await User.deleteMany({ email: { $in: demoEmails } });

    const demoUsers = [
      // ── Team accounts ────────────────────────────────────────
      { full_name: 'Admin Demo',  email: 'admin@hackathon.dev',    password: 'AdminPass123',     role: 'admin' },
      { full_name: 'M_1',         email: 'hr@hackathon.dev',        password: 'HRPass123',        role: 'hr'    },
      { full_name: 'M_2',         email: 'member3@hackathon.dev',   password: 'RecruiterPass123', role: 'hr'    },
      { full_name: 'M_4',         email: 'member4@hackathon.dev',   password: 'TeamPass123',      role: 'hr'    },
      // ── Judge accounts ───────────────────────────────────────
      { full_name: 'Judge One',   email: 'judge1@talentscreen.demo', password: 'Judge#Demo1',     role: 'hr'    },
      { full_name: 'Judge Two',   email: 'judge2@talentscreen.demo', password: 'Judge#Demo2',     role: 'hr'    },
    ];

    for (const userData of demoUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      await User.create({ ...userData, password: hashedPassword });
      console.log(`✅ Created: ${userData.email} (${userData.role})`);
    }

    console.log('\n🔑 Team Login Credentials:');
    demoUsers.slice(0, 4).forEach(u => console.log(`   ${u.email} / ${u.password}`));

    console.log('\n👨‍⚖️  Judge Login Credentials:');
    demoUsers.slice(4).forEach(u => console.log(`   ${u.email} / ${u.password}`));

    console.log('\n✅ Seeding complete!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedUsers();
