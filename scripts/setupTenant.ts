/**
 * Tenant Setup Script - Production Deployment for WanPaus v4.0
 * 
 * Sets up the default tenant and system configuration for production deployment.
 * Creates the necessary database records and initializes the system for operation.
 * 
 * Business Rules:
 * - Creates default tenant with initial capital allocation
 * - Sets up system admin user for tenant management
 * - Initializes tenant-scoped system settings
 * - Configures PNG timezone and currency settings
 * 
 * Usage:
 * - npm run setup:tenant
 * - tsx scripts/setupTenant.ts
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Tenant from '@/models/Tenant';
import User from '@/models/User';
import { ITenantSystemSettings } from '@/models/SystemSettings';
import AuditLog, { AuditAction } from '@/models/AuditLog';

// Configuration
const TENANT_CONFIG = {
  name: 'WanPaus Default',
  code: 'default',
  displayName: 'WanPaus Microfinance',
  initialCapital: parseFloat(process.env.INITIAL_CASH_BALANCE || '10000'),
  timezone: 'Pacific/Port_Moresby',
  currency: 'PGK',
  interestRates: {
    term14: 0.30,
    term30: 0.60,
    term60: 0.75,
    term90: 1.00,
  },
};

const ADMIN_CONFIG = {
  name: process.env.ADMIN_NAME || 'System Administrator',
  email: process.env.ADMIN_EMAIL || 'admin@wanpaus.com.pg',
  phone: process.env.ADMIN_PHONE || '+675 123 4567',
  password: process.env.ADMIN_PASSWORD || 'WanPaus2024!',
};

async function connectDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');
}

async function createDefaultTenant(): Promise<any> {
  console.log('🏢 Creating default tenant...');

  // Check if default tenant already exists
  const existingTenant = await Tenant.findOne({ code: TENANT_CONFIG.code });
  if (existingTenant) {
    console.log('⚠️  Default tenant already exists');
    return existingTenant;
  }

  // Create system admin user first (needed for tenant creation)
  const hashedPassword = await bcrypt.hash(ADMIN_CONFIG.password, 12);
  const systemAdmin = new User({
    tenantId: new mongoose.Types.ObjectId('000000000000000000000000'), // Temporary
    name: ADMIN_CONFIG.name,
    email: ADMIN_CONFIG.email,
    phone: ADMIN_CONFIG.phone,
    password: hashedPassword,
    role: 'admin',
    currentLimit: 0,
    isTrustworthy: false,
    kyc: { verified: true },
    status: 'active',
    consecutiveOnTimePayments: 0,
    totalConsecutiveOnTimePayments: 0,
  });

  await systemAdmin.save();
  console.log('👤 Created system admin user');

  // Create default tenant
  const tenant = new Tenant({
    name: TENANT_CONFIG.name,
    code: TENANT_CONFIG.code,
    displayName: TENANT_CONFIG.displayName,
    initialCapital: TENANT_CONFIG.initialCapital,
    currentCapital: TENANT_CONFIG.initialCapital,
    totalDisbursed: 0,
    totalRepaid: 0,
    maxLoanAmount: 1000,
    minLoanAmount: 50,
    gracePeriodDays: 7,
    interestRates: TENANT_CONFIG.interestRates,
    kycRequired: true,
    complianceLevel: 'standard',
    regulatoryReporting: true,
    isActive: true,
    timezone: TENANT_CONFIG.timezone,
    currency: TENANT_CONFIG.currency,
    createdBy: systemAdmin._id,
  });

  await tenant.save();
  console.log(`✅ Created default tenant: ${tenant.displayName}`);

  // Update admin user with correct tenant ID
  systemAdmin.tenantId = tenant._id;
  await systemAdmin.save();
  console.log('🔄 Updated admin user with tenant ID');

  return tenant;
}

async function createTenantSystemSettings(tenant: any): Promise<void> {
  console.log('⚙️  Creating tenant system settings...');

  const SystemSettings = mongoose.models.SystemSettings;
  if (!SystemSettings) {
    throw new Error('SystemSettings model not found');
  }

  // Check if settings already exist
  const settingsId = `tenant-${tenant._id.toString()}`;
  const existingSettings = await SystemSettings.findById(settingsId);
  
  if (existingSettings) {
    console.log('⚠️  Tenant system settings already exist');
    return;
  }

  // Create tenant-scoped system settings
  const settings = new SystemSettings({
    _id: settingsId,
    tenantId: tenant._id,
    cashOnHand: tenant.currentCapital,
    totalDisbursed: 0,
    totalRepaid: 0,
    interestEarned: 0,
    maxLoanAmount: tenant.maxLoanAmount,
    minLoanAmount: tenant.minLoanAmount,
    gracePeriodDays: tenant.gracePeriodDays,
  });

  await settings.save();
  console.log('✅ Created tenant system settings');
}

async function createInitialAuditLog(tenant: any, admin: any): Promise<void> {
  console.log('📝 Creating initial audit log...');

  await AuditLog.createEntry({
    tenantId: tenant._id,
    action: AuditAction.TENANT_CREATED,
    actorId: admin._id,
    actorType: 'admin',
    entityType: 'tenant',
    entityId: tenant._id,
    entityReference: tenant.code,
    metadata: {
      tenantName: tenant.name,
      initialCapital: tenant.initialCapital,
      timezone: tenant.timezone,
      currency: tenant.currency,
      setupScript: true,
    },
  });

  console.log('✅ Created initial audit log');
}

async function validateSetup(tenant: any): Promise<void> {
  console.log('🔍 Validating setup...');

  // Check tenant
  const tenantCheck = await Tenant.findById(tenant._id);
  if (!tenantCheck) {
    throw new Error('Tenant validation failed');
  }

  // Check admin user
  const adminCheck = await User.findOne({
    tenantId: tenant._id,
    role: 'admin',
    email: ADMIN_CONFIG.email,
  });
  if (!adminCheck) {
    throw new Error('Admin user validation failed');
  }

  // Check system settings
  const SystemSettings = mongoose.models.SystemSettings;
  const settingsCheck = await SystemSettings.findById(`tenant-${tenant._id.toString()}`);
  if (!settingsCheck) {
    throw new Error('System settings validation failed');
  }

  // Check audit log
  const auditCheck = await AuditLog.findOne({
    tenantId: tenant._id,
    action: AuditAction.TENANT_CREATED,
  });
  if (!auditCheck) {
    throw new Error('Audit log validation failed');
  }

  console.log('✅ Setup validation passed');
}

async function displaySetupSummary(tenant: any): Promise<void> {
  console.log('\n🎉 SETUP COMPLETE!');
  console.log('==================');
  console.log(`Tenant: ${tenant.displayName} (${tenant.code})`);
  console.log(`Initial Capital: ${tenant.currency} ${tenant.initialCapital.toLocaleString()}`);
  console.log(`Available for Lending: ${tenant.currency} ${tenant.availableLendingCapital.toLocaleString()}`);
  console.log(`Reserved for Operations: ${tenant.currency} ${tenant.reservedForOperations.toLocaleString()}`);
  console.log(`Timezone: ${tenant.timezone}`);
  console.log(`Currency: ${tenant.currency}`);
  console.log('\nAdmin User:');
  console.log(`Email: ${ADMIN_CONFIG.email}`);
  console.log(`Password: ${ADMIN_CONFIG.password}`);
  console.log('\nInterest Rates:');
  console.log(`14 days: ${(tenant.interestRates.term14 * 100).toFixed(1)}%`);
  console.log(`30 days: ${(tenant.interestRates.term30 * 100).toFixed(1)}%`);
  console.log(`60 days: ${(tenant.interestRates.term60 * 100).toFixed(1)}%`);
  console.log(`90 days: ${(tenant.interestRates.term90 * 100).toFixed(1)}%`);
  console.log('\n🚀 System is ready for production deployment!');
}

async function main(): Promise<void> {
  try {
    console.log('🚀 WanPaus v4.0 Tenant Setup');
    console.log('============================');

    // Connect to database
    await connectDatabase();

    // Create default tenant and admin user
    const tenant = await createDefaultTenant();

    // Get admin user
    const admin = await User.findOne({
      tenantId: tenant._id,
      role: 'admin',
      email: ADMIN_CONFIG.email,
    });

    if (!admin) {
      throw new Error('Admin user not found after creation');
    }

    // Create tenant system settings
    await createTenantSystemSettings(tenant);

    // Create initial audit log
    await createInitialAuditLog(tenant, admin);

    // Validate setup
    await validateSetup(tenant);

    // Display summary
    await displaySetupSummary(tenant);

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run setup if called directly
if (require.main === module) {
  main();
}

export { main as setupTenant };
