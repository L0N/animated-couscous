import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config({ path: '.env.local' });

// Import models
import '../models/User';
import '../models/SystemSettings';

const User = mongoose.model('User');
const SystemSettings = mongoose.model('SystemSettings');

async function seedSystem() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not defined in environment');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Create or update SystemSettings
    console.log('💰 Initializing system settings...');
    const initialCash = parseFloat(process.env.INITIAL_CASH_BALANCE || '10000');

    const settings = await SystemSettings.findById('singleton');
    if (settings) {
      console.log('✓ System settings already exist');
    } else {
      await SystemSettings.create({
        _id: 'singleton',
        cashOnHand: initialCash,
        totalDisbursed: 0,
        totalRepaid: 0,
        interestEarned: 0,
      });
      console.log(`✅ System settings created with K${initialCash} cash on hand`);
    }

    // Create admin user
    console.log('👤 Creating admin user...');
    const adminEmail = process.env.SYSTEM_ADMIN_EMAIL || 'admin@wanpaus.com.pg';
    const adminPassword = process.env.SYSTEM_ADMIN_PASSWORD || 'Admin123!';

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('✓ Admin user already exists');
    } else {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await User.create({
        name: 'System Administrator',
        email: adminEmail,
        phone: '+675 7000 0000',
        password: hashedPassword,
        role: 'admin',
        currentLimit: 0,
        onTimeCount: 0,
        isTrustworthy: false,
      });
      console.log(`✅ Admin user created: ${adminEmail}`);
      console.log(`🔐 Admin password: ${adminPassword}`);
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Start the development server: npm run dev');
    console.log('2. Login at http://localhost:3000');
    console.log(`3. Use email: ${adminEmail}`);
    console.log(`4. Use password: ${adminPassword}`);

  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

seedSystem();

