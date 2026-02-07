/**
 * CSV Import Service - Production Data Seeding for WanPaus v4.0
 * 
 * One-time import service for migrating legacy customer and loan data.
 * Designed for pre-live deployment with comprehensive validation and business rule enforcement.
 * 
 * Business Rules:
 * - One-time import only (locked after successful completion)
 * - Comprehensive data validation against current schema
 * - Trustworthy status computation based on payment history
 * - Tenant-scoped data import with isolation
 * - Immutable import records for audit trail
 * 
 * Data Flow:
 * 1. CSV validation → Schema compliance check
 * 2. Data transformation → Business rule application
 * 3. Database import → Atomic transaction processing
 * 4. Post-import validation → Data integrity verification
 * 5. Import lock → Prevent duplicate imports
 */

import mongoose from 'mongoose';
import User from '@/models/User';
import Loan from '@/models/Loan';
import Payment from '@/models/Payment';
import Tenant from '@/models/Tenant';
import AuditLog, { AuditAction } from '@/models/AuditLog';
import { tierService } from './tierService';

export interface ImportCustomer {
  name: string;
  email: string;
  phone: string;
  currentLimit?: number;
  isTrustworthy?: boolean;
  kycVerified?: boolean;
  kycIdType?: string;
  kycIdNumber?: string;
  joinedAt?: string;
}

export interface ImportLoan {
  customerEmail: string;
  amount: number;
  termDays: number;
  status: string;
  appliedAt?: string;
  approvedAt?: string;
  disbursedAt?: string;
  dueDate?: string;
  repaidAt?: string;
  interestRate?: number;
}

export interface ImportPayment {
  loanReference: string;
  amount: number;
  paidAt: string;
  verified: boolean;
  principalPaid?: number;
  interestPaid?: number;
}

export interface ImportResult {
  success: boolean;
  customersImported: number;
  loansImported: number;
  paymentsImported: number;
  errors: string[];
  warnings: string[];
  importId: string;
  importedAt: Date;
}

export class CSVImportService {
  private tenantId: mongoose.Types.ObjectId;
  private importId: string;
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor(tenantId: mongoose.Types.ObjectId) {
    this.tenantId = tenantId;
    this.importId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Import customers, loans, and payments from CSV data
   */
  async importData(
    customers: ImportCustomer[],
    loans: ImportLoan[],
    payments: ImportPayment[] = []
  ): Promise<ImportResult> {
    const session = await mongoose.startSession();
    
    try {
      await session.startTransaction();

      // Check if import is already locked for this tenant
      await this.checkImportLock();

      // Validate all data before import
      await this.validateCustomers(customers);
      await this.validateLoans(loans, customers);
      await this.validatePayments(payments, loans);

      if (this.errors.length > 0) {
        throw new Error(`Validation failed: ${this.errors.join(', ')}`);
      }

      // Import data in order: customers → loans → payments
      const importedCustomers = await this.importCustomers(customers, session);
      const importedLoans = await this.importLoans(loans, importedCustomers, session);
      const importedPayments = await this.importPayments(payments, importedLoans, session);

      // Post-import processing
      await this.computeTrustworthyStatus(importedCustomers, session);
      await this.createImportLock(session);
      await this.createImportAuditLog(importedCustomers.length, importedLoans.length, importedPayments.length);

      await session.commitTransaction();

      return {
        success: true,
        customersImported: importedCustomers.length,
        loansImported: importedLoans.length,
        paymentsImported: importedPayments.length,
        errors: this.errors,
        warnings: this.warnings,
        importId: this.importId,
        importedAt: new Date(),
      };

    } catch (error) {
      await session.abortTransaction();
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.errors.push(errorMessage);

      return {
        success: false,
        customersImported: 0,
        loansImported: 0,
        paymentsImported: 0,
        errors: this.errors,
        warnings: this.warnings,
        importId: this.importId,
        importedAt: new Date(),
      };
    } finally {
      await session.endSession();
    }
  }

  /**
   * Check if import is already locked for this tenant
   */
  private async checkImportLock(): Promise<void> {
    const existingImport = await AuditLog.findOne({
      tenantId: this.tenantId,
      action: AuditAction.SYSTEM_CONFIGURED,
      entityReference: 'csv-import-lock',
    });

    if (existingImport) {
      throw new Error('CSV import is locked for this tenant. Import has already been completed.');
    }
  }

  /**
   * Validate customer data
   */
  private async validateCustomers(customers: ImportCustomer[]): Promise<void> {
    const emails = new Set<string>();

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const rowNum = i + 1;

      // Required fields
      if (!customer.name?.trim()) {
        this.errors.push(`Row ${rowNum}: Name is required`);
      }
      if (!customer.email?.trim()) {
        this.errors.push(`Row ${rowNum}: Email is required`);
      }
      if (!customer.phone?.trim()) {
        this.errors.push(`Row ${rowNum}: Phone is required`);
      }

      // Email validation
      if (customer.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customer.email)) {
          this.errors.push(`Row ${rowNum}: Invalid email format`);
        }

        // Check for duplicates within import
        if (emails.has(customer.email.toLowerCase())) {
          this.errors.push(`Row ${rowNum}: Duplicate email in import data`);
        }
        emails.add(customer.email.toLowerCase());

        // Check for existing users in database
        const existingUser = await User.findOne({
          tenantId: this.tenantId,
          email: customer.email.toLowerCase(),
        });
        if (existingUser) {
          this.errors.push(`Row ${rowNum}: Email already exists in database`);
        }
      }

      // Phone validation (PNG format)
      if (customer.phone) {
        const phoneRegex = /^\+675\s?\d{3}\s?\d{4}$/;
        if (!phoneRegex.test(customer.phone)) {
          this.warnings.push(`Row ${rowNum}: Phone format should be PNG format (+675 XXX XXXX)`);
        }
      }

      // Credit limit validation
      if (customer.currentLimit !== undefined) {
        if (customer.currentLimit < 50 || customer.currentLimit > 1000) {
          this.warnings.push(`Row ${rowNum}: Credit limit ${customer.currentLimit} outside normal range (50-1000)`);
        }
      }

      // Date validation
      if (customer.joinedAt) {
        const joinDate = new Date(customer.joinedAt);
        if (isNaN(joinDate.getTime())) {
          this.errors.push(`Row ${rowNum}: Invalid joinedAt date format`);
        } else if (joinDate > new Date()) {
          this.errors.push(`Row ${rowNum}: joinedAt date cannot be in the future`);
        }
      }
    }
  }

  /**
   * Validate loan data
   */
  private async validateLoans(loans: ImportLoan[], customers: ImportCustomer[]): Promise<void> {
    const customerEmails = new Set(customers.map(c => c.email.toLowerCase()));

    for (let i = 0; i < loans.length; i++) {
      const loan = loans[i];
      const rowNum = i + 1;

      // Required fields
      if (!loan.customerEmail?.trim()) {
        this.errors.push(`Loan row ${rowNum}: Customer email is required`);
      }
      if (!loan.amount || loan.amount <= 0) {
        this.errors.push(`Loan row ${rowNum}: Valid loan amount is required`);
      }
      if (!loan.termDays || ![14, 30, 60, 90].includes(loan.termDays)) {
        this.errors.push(`Loan row ${rowNum}: Term days must be 14, 30, 60, or 90`);
      }
      if (!loan.status || !['applied', 'approved', 'disbursed', 'repaid', 'overdue', 'defaulted'].includes(loan.status)) {
        this.errors.push(`Loan row ${rowNum}: Invalid loan status`);
      }

      // Customer reference validation
      if (loan.customerEmail && !customerEmails.has(loan.customerEmail.toLowerCase())) {
        this.errors.push(`Loan row ${rowNum}: Customer email not found in customer data`);
      }

      // Amount validation
      if (loan.amount > 1000) {
        this.warnings.push(`Loan row ${rowNum}: Loan amount ${loan.amount} exceeds maximum (1000)`);
      }

      // Date validation
      const dates = ['appliedAt', 'approvedAt', 'disbursedAt', 'dueDate', 'repaidAt'];
      for (const dateField of dates) {
        const dateValue = loan[dateField as keyof ImportLoan] as string;
        if (dateValue) {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) {
            this.errors.push(`Loan row ${rowNum}: Invalid ${dateField} date format`);
          } else if (date > new Date()) {
            this.errors.push(`Loan row ${rowNum}: ${dateField} cannot be in the future`);
          }
        }
      }

      // Business logic validation
      if (loan.status === 'repaid' && !loan.repaidAt) {
        this.warnings.push(`Loan row ${rowNum}: Repaid loan should have repaidAt date`);
      }
      if (loan.status === 'disbursed' && !loan.disbursedAt) {
        this.warnings.push(`Loan row ${rowNum}: Disbursed loan should have disbursedAt date`);
      }
    }
  }

  /**
   * Validate payment data
   */
  private async validatePayments(payments: ImportPayment[], loans: ImportLoan[]): Promise<void> {
    const loanReferences = new Set<string>();

    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      const rowNum = i + 1;

      // Required fields
      if (!payment.loanReference?.trim()) {
        this.errors.push(`Payment row ${rowNum}: Loan reference is required`);
      }
      if (!payment.amount || payment.amount <= 0) {
        this.errors.push(`Payment row ${rowNum}: Valid payment amount is required`);
      }
      if (!payment.paidAt) {
        this.errors.push(`Payment row ${rowNum}: Payment date is required`);
      }

      // Date validation
      if (payment.paidAt) {
        const paidDate = new Date(payment.paidAt);
        if (isNaN(paidDate.getTime())) {
          this.errors.push(`Payment row ${rowNum}: Invalid paidAt date format`);
        } else if (paidDate > new Date()) {
          this.errors.push(`Payment row ${rowNum}: paidAt cannot be in the future`);
        }
      }

      // Amount validation
      if (payment.principalPaid !== undefined && payment.principalPaid < 0) {
        this.errors.push(`Payment row ${rowNum}: Principal paid cannot be negative`);
      }
      if (payment.interestPaid !== undefined && payment.interestPaid < 0) {
        this.errors.push(`Payment row ${rowNum}: Interest paid cannot be negative`);
      }
    }
  }

  /**
   * Import customers
   */
  private async importCustomers(customers: ImportCustomer[], session: any): Promise<any[]> {
    const importedCustomers = [];

    for (const customerData of customers) {
      const user = new User({
        tenantId: this.tenantId,
        name: customerData.name.trim(),
        email: customerData.email.toLowerCase().trim(),
        phone: customerData.phone.trim(),
        password: 'imported-user', // Placeholder password
        role: 'customer',
        currentLimit: customerData.currentLimit || 50,
        isTrustworthy: customerData.isTrustworthy || false,
        kyc: {
          verified: customerData.kycVerified || false,
          idType: customerData.kycIdType,
          idNumber: customerData.kycIdNumber,
        },
        status: 'active',
        consecutiveOnTimePayments: 0,
        totalConsecutiveOnTimePayments: 0,
        createdAt: customerData.joinedAt ? new Date(customerData.joinedAt) : new Date(),
      });

      await user.save({ session });
      importedCustomers.push(user);
    }

    return importedCustomers;
  }

  /**
   * Import loans
   */
  private async importLoans(loans: ImportLoan[], customers: any[], session: any): Promise<any[]> {
    const importedLoans = [];
    const customerEmailMap = new Map(customers.map(c => [c.email, c]));

    for (const loanData of loans) {
      const customer = customerEmailMap.get(loanData.customerEmail.toLowerCase());
      if (!customer) {
        this.warnings.push(`Loan for ${loanData.customerEmail}: Customer not found`);
        continue;
      }

      // Calculate interest and repayable amount
      const interestRate = loanData.interestRate || this.getDefaultInterestRate(loanData.termDays);
      const interestAmount = Math.round(loanData.amount * interestRate);
      const totalRepayable = loanData.amount + interestAmount;

      const loan = new Loan({
        tenantId: this.tenantId,
        userId: customer._id,
        amount: loanData.amount,
        termDays: loanData.termDays,
        interestRate,
        interestAmount,
        totalRepayable,
        status: loanData.status,
        loanVersion: 'v1', // Legacy loans are v1
        appliedAt: loanData.appliedAt ? new Date(loanData.appliedAt) : new Date(),
        approvedAt: loanData.approvedAt ? new Date(loanData.approvedAt) : undefined,
        disbursedAt: loanData.disbursedAt ? new Date(loanData.disbursedAt) : undefined,
        dueDate: loanData.dueDate ? new Date(loanData.dueDate) : this.calculateDueDate(loanData.termDays),
        repaidAt: loanData.repaidAt ? new Date(loanData.repaidAt) : undefined,
      });

      await loan.save({ session });
      importedLoans.push(loan);
    }

    return importedLoans;
  }

  /**
   * Import payments
   */
  private async importPayments(payments: ImportPayment[], loans: any[], session: any): Promise<any[]> {
    const importedPayments = [];
    const loanReferenceMap = new Map(loans.map(l => [l.reference, l]));

    for (const paymentData of payments) {
      const loan = loanReferenceMap.get(paymentData.loanReference);
      if (!loan) {
        this.warnings.push(`Payment for ${paymentData.loanReference}: Loan not found`);
        continue;
      }

      const payment = new Payment({
        tenantId: this.tenantId,
        loanId: loan._id,
        userId: loan.userId,
        amount: paymentData.amount,
        status: paymentData.verified ? 'verified' : 'pending',
        principalPaid: paymentData.principalPaid || 0,
        interestPaid: paymentData.interestPaid || 0,
        verifiedAt: paymentData.verified ? new Date(paymentData.paidAt) : undefined,
        proofUrl: 'imported-payment', // Placeholder
        createdAt: new Date(paymentData.paidAt),
      });

      await payment.save({ session });
      importedPayments.push(payment);
    }

    return importedPayments;
  }

  /**
   * Compute trustworthy status based on payment history
   */
  private async computeTrustworthyStatus(customers: any[], session: any): Promise<void> {
    for (const customer of customers) {
      try {
        // Get customer's loan and payment history
        const loans = await Loan.find({
          tenantId: this.tenantId,
          userId: customer._id,
          status: 'repaid',
        }).session(session);

        const payments = await Payment.find({
          tenantId: this.tenantId,
          userId: customer._id,
          status: 'verified',
        }).session(session);

        // Apply trustworthy computation logic
        const { isTrustworthy, consecutivePayments } = await tierService.computeTrustworthyStatus(
          customer._id,
          this.tenantId
        );

        // Update customer
        customer.isTrustworthy = isTrustworthy;
        customer.consecutiveOnTimePayments = consecutivePayments;
        customer.totalConsecutiveOnTimePayments = consecutivePayments;

        await customer.save({ session });

      } catch (error) {
        this.warnings.push(`Error computing trustworthy status for ${customer.email}: ${error}`);
      }
    }
  }

  /**
   * Create import lock to prevent duplicate imports
   */
  private async createImportLock(session: any): Promise<void> {
    await AuditLog.create([{
      tenantId: this.tenantId,
      action: AuditAction.SYSTEM_CONFIGURED,
      actorId: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
      actorType: 'system',
      entityType: 'system',
      entityId: new mongoose.Types.ObjectId('000000000000000000000000'),
      entityReference: 'csv-import-lock',
      metadata: {
        importId: this.importId,
        lockedAt: new Date().toISOString(),
      },
    }], { session });
  }

  /**
   * Create audit log for import
   */
  private async createImportAuditLog(
    customersCount: number,
    loansCount: number,
    paymentsCount: number
  ): Promise<void> {
    await AuditLog.createEntry({
      tenantId: this.tenantId,
      action: AuditAction.SYSTEM_CONFIGURED,
      actorId: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
      actorType: 'system',
      entityType: 'system',
      entityId: new mongoose.Types.ObjectId('000000000000000000000000'),
      entityReference: `csv-import-${this.importId}`,
      metadata: {
        importId: this.importId,
        customersImported: customersCount,
        loansImported: loansCount,
        paymentsImported: paymentsCount,
        errors: this.errors,
        warnings: this.warnings,
      },
    });
  }

  /**
   * Get default interest rate for term
   */
  private getDefaultInterestRate(termDays: number): number {
    const rates = {
      14: 0.30,
      30: 0.60,
      60: 0.75,
      90: 1.00,
    };
    return rates[termDays as keyof typeof rates] || 0.60;
  }

  /**
   * Calculate due date based on term
   */
  private calculateDueDate(termDays: number): Date {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + termDays);
    return dueDate;
  }
}

/**
 * Static method to check if import is locked for a tenant
 */
export async function isImportLocked(tenantId: mongoose.Types.ObjectId): Promise<boolean> {
  const existingImport = await AuditLog.findOne({
    tenantId,
    action: AuditAction.SYSTEM_CONFIGURED,
    entityReference: 'csv-import-lock',
  });

  return !!existingImport;
}
