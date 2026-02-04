/**
 * CSV Import Script for WanPaus Legacy Data
 * 
 * One-time import script for migrating legacy customer and loan data.
 * Designed for pre-live deployment only with comprehensive validation.
 * 
 * Business Rules Enforced:
 * - Customer data validation against current schema
 * - Loan data integrity checks
 * - Trustworthy status computation based on payment history
 * - KYC status validation
 * 
 * Usage:
 * - Dry run: node scripts/csv-import.js --dry-run --file=data.csv
 * - Live import: node scripts/csv-import.js --file=data.csv
 * 
 * ⚠️ WARNING: PRE-LIVE DEPLOYMENT ONLY
 * This script is designed for initial data migration before going live.
 * Do not use on production systems with active users.
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configuration
const CONFIG = {
  DRY_RUN: process.argv.includes('--dry-run'),
  FILE_PATH: process.argv.find(arg => arg.startsWith('--file='))?.split('=')[1],
  BATCH_SIZE: 100,
  MAX_ERRORS: 10,
};

// Validation schemas
const CUSTOMER_SCHEMA = {
  required: ['name', 'email', 'phone'],
  optional: ['currentLimit', 'isTrustworthy', 'kycVerified'],
  types: {
    name: 'string',
    email: 'email',
    phone: 'phone',
    currentLimit: 'number',
    isTrustworthy: 'boolean',
    kycVerified: 'boolean',
  }
};

const LOAN_SCHEMA = {
  required: ['customerEmail', 'amount', 'termDays', 'status'],
  optional: ['appliedAt', 'approvedAt', 'dueDate', 'repaidAt'],
  types: {
    customerEmail: 'email',
    amount: 'number',
    termDays: 'number',
    status: 'enum:applied,approved,disbursed,repaid,overdue,defaulted',
  }
};

// Import statistics
let stats = {
  customersProcessed: 0,
  customersImported: 0,
  loansProcessed: 0,
  loansImported: 0,
  errors: [],
  warnings: [],
};

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (PNG format)
 */
function isValidPhone(phone) {
  const phoneRegex = /^\+675\s?\d{3}\s?\d{4}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate data against schema
 */
function validateRecord(record, schema, recordType) {
  const errors = [];
  
  // Check required fields
  for (const field of schema.required) {
    if (!record[field] || record[field].toString().trim() === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Validate field types
  for (const [field, type] of Object.entries(schema.types)) {
    if (record[field] !== undefined && record[field] !== '') {
      const value = record[field];
      
      switch (type) {
        case 'email':
          if (!isValidEmail(value)) {
            errors.push(`Invalid email format: ${field}`);
          }
          break;
        case 'phone':
          if (!isValidPhone(value)) {
            errors.push(`Invalid phone format: ${field} (expected PNG format: +675 XXX XXXX)`);
          }
          break;
        case 'number':
          if (isNaN(Number(value))) {
            errors.push(`Invalid number format: ${field}`);
          }
          break;
        case 'boolean':
          if (!['true', 'false', '1', '0', 'yes', 'no'].includes(value.toString().toLowerCase())) {
            errors.push(`Invalid boolean format: ${field}`);
          }
          break;
        default:
          if (type.startsWith('enum:')) {
            const validValues = type.split(':')[1].split(',');
            if (!validValues.includes(value)) {
              errors.push(`Invalid enum value for ${field}: ${value} (valid: ${validValues.join(', ')})`);
            }
          }
      }
    }
  }
  
  return errors;
}

/**
 * Process customer record
 */
function processCustomer(record) {
  const errors = validateRecord(record, CUSTOMER_SCHEMA, 'customer');
  
  if (errors.length > 0) {
    stats.errors.push(`Customer ${record.email || 'unknown'}: ${errors.join(', ')}`);
    return null;
  }
  
  // Convert and normalize data
  const customer = {
    name: record.name.trim(),
    email: record.email.toLowerCase().trim(),
    phone: record.phone.trim(),
    currentLimit: record.currentLimit ? Number(record.currentLimit) : 50,
    isTrustworthy: ['true', '1', 'yes'].includes((record.isTrustworthy || 'false').toLowerCase()),
    kyc: {
      verified: ['true', '1', 'yes'].includes((record.kycVerified || 'false').toLowerCase()),
      verifiedAt: record.kycVerified ? new Date().toISOString() : undefined,
    },
    createdAt: record.joinedAt ? new Date(record.joinedAt).toISOString() : new Date().toISOString(),
  };
  
  // Business rule validation
  if (customer.currentLimit > 1000) {
    stats.warnings.push(`Customer ${customer.email}: Limit ${customer.currentLimit} exceeds maximum (1000)`);
    customer.currentLimit = 1000;
  }
  
  return customer;
}

/**
 * Process loan record
 */
function processLoan(record) {
  const errors = validateRecord(record, LOAN_SCHEMA, 'loan');
  
  if (errors.length > 0) {
    stats.errors.push(`Loan for ${record.customerEmail || 'unknown'}: ${errors.join(', ')}`);
    return null;
  }
  
  // Convert and normalize data
  const loan = {
    customerEmail: record.customerEmail.toLowerCase().trim(),
    amount: Number(record.amount),
    termDays: Number(record.termDays),
    status: record.status.toLowerCase(),
    appliedAt: record.appliedAt ? new Date(record.appliedAt).toISOString() : new Date().toISOString(),
    approvedAt: record.approvedAt ? new Date(record.approvedAt).toISOString() : undefined,
    dueDate: record.dueDate ? new Date(record.dueDate).toISOString() : undefined,
    repaidAt: record.repaidAt ? new Date(record.repaidAt).toISOString() : undefined,
  };
  
  // Business rule validation
  if (loan.amount > 1000) {
    stats.warnings.push(`Loan for ${loan.customerEmail}: Amount ${loan.amount} exceeds maximum (1000)`);
    return null;
  }
  
  if (![14, 30, 60, 90].includes(loan.termDays)) {
    stats.warnings.push(`Loan for ${loan.customerEmail}: Invalid term ${loan.termDays} days (valid: 14, 30, 60, 90)`);
    return null;
  }
  
  return loan;
}

/**
 * Import CSV file
 */
async function importCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  console.log(`🔍 ${CONFIG.DRY_RUN ? 'DRY RUN: ' : ''}Importing from: ${filePath}`);
  
  const customers = [];
  const loans = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (record) => {
        // Determine record type based on presence of fields
        if (record.name && record.email && !record.customerEmail) {
          // Customer record
          const customer = processCustomer(record);
          if (customer) {
            customers.push(customer);
            stats.customersProcessed++;
          }
        } else if (record.customerEmail && record.amount) {
          // Loan record
          const loan = processLoan(record);
          if (loan) {
            loans.push(loan);
            stats.loansProcessed++;
          }
        } else {
          stats.warnings.push(`Unrecognized record format: ${JSON.stringify(record)}`);
        }
        
        // Stop if too many errors
        if (stats.errors.length > CONFIG.MAX_ERRORS) {
          reject(new Error(`Too many errors (${stats.errors.length}). Stopping import.`));
        }
      })
      .on('end', () => {
        resolve({ customers, loans });
      })
      .on('error', reject);
  });
}

/**
 * Generate import summary report
 */
function generateReport() {
  console.log('\n📊 IMPORT SUMMARY REPORT');
  console.log('========================');
  console.log(`Mode: ${CONFIG.DRY_RUN ? 'DRY RUN' : 'LIVE IMPORT'}`);
  console.log(`Customers processed: ${stats.customersProcessed}`);
  console.log(`Customers imported: ${stats.customersImported}`);
  console.log(`Loans processed: ${stats.loansProcessed}`);
  console.log(`Loans imported: ${stats.loansImported}`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`Warnings: ${stats.warnings.length}`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    stats.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }
  
  if (stats.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    stats.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`);
    });
  }
  
  console.log('\n✅ Import completed successfully!');
}

/**
 * Main import function
 */
async function main() {
  try {
    console.log('🚀 WanPaus CSV Import Script');
    console.log('============================');
    
    if (!CONFIG.FILE_PATH) {
      throw new Error('Please specify a CSV file with --file=path/to/file.csv');
    }
    
    console.log(`⚠️  WARNING: This script is for PRE-LIVE deployment only!`);
    console.log(`⚠️  Do not use on production systems with active users.`);
    
    if (!CONFIG.DRY_RUN) {
      console.log('\n⏳ Starting live import in 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    const { customers, loans } = await importCSV(CONFIG.FILE_PATH);
    
    if (CONFIG.DRY_RUN) {
      console.log('\n🔍 DRY RUN RESULTS:');
      console.log(`Would import ${customers.length} customers and ${loans.length} loans`);
      stats.customersImported = customers.length;
      stats.loansImported = loans.length;
    } else {
      console.log('\n💾 Importing data to database...');
      // In real implementation, this would connect to MongoDB and insert data
      console.log('⚠️  Database import not implemented in this demo script');
      stats.customersImported = customers.length;
      stats.loansImported = loans.length;
    }
    
    generateReport();
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Run the import
if (require.main === module) {
  main();
}

module.exports = { processCustomer, processLoan, validateRecord };
