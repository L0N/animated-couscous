/**
 * Interest Calculation Model (v2.0.0)
 * 
 * Provides complete audit trail for all interest calculations
 * Required for regulatory compliance and calculation verification
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IInterestCalculation extends Document {
  _id: string;
  loanId: string;
  calculationDate: Date;
  lastCalculationDate: Date;
  daysElapsed: number;
  outstandingPrincipal: number;
  annualInterestRate: number;
  dailyInterestRate: number;
  interestAccrued: number;
  totalAccruedBefore: number;
  totalAccruedAfter: number;
  interestCap: number;
  isCapReached: boolean;
  calculationType: 'daily_accrual' | 'payment_calculation' | 'default_freeze' | 'manual_adjustment';
  triggeredBy: 'cron_job' | 'payment_processing' | 'loan_disbursement' | 'admin_action' | 'simulation';
  auditTrail: string;
  metadata?: {
    paymentId?: string;
    adminUserId?: string;
    simulationId?: string;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const interestCalculationSchema = new Schema<IInterestCalculation>({
  loanId: {
    type: String,
    required: true,
    index: true,
  },
  calculationDate: {
    type: Date,
    required: true,
    index: true,
  },
  lastCalculationDate: {
    type: Date,
    required: true,
  },
  daysElapsed: {
    type: Number,
    required: true,
    min: 0,
  },
  outstandingPrincipal: {
    type: Number,
    required: true,
    min: 0,
  },
  annualInterestRate: {
    type: Number,
    required: true,
    min: 0,
  },
  dailyInterestRate: {
    type: Number,
    required: true,
    min: 0,
  },
  interestAccrued: {
    type: Number,
    required: true,
    min: 0,
  },
  totalAccruedBefore: {
    type: Number,
    required: true,
    min: 0,
  },
  totalAccruedAfter: {
    type: Number,
    required: true,
    min: 0,
  },
  interestCap: {
    type: Number,
    required: true,
    min: 0,
  },
  isCapReached: {
    type: Boolean,
    required: true,
    default: false,
  },
  calculationType: {
    type: String,
    enum: ['daily_accrual', 'payment_calculation', 'default_freeze', 'manual_adjustment'],
    required: true,
    index: true,
  },
  triggeredBy: {
    type: String,
    enum: ['cron_job', 'payment_processing', 'loan_disbursement', 'admin_action', 'simulation'],
    required: true,
    index: true,
  },
  auditTrail: {
    type: String,
    required: true,
  },
  metadata: {
    paymentId: String,
    adminUserId: String,
    simulationId: String,
    notes: String,
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
interestCalculationSchema.index({ loanId: 1, calculationDate: -1 });
interestCalculationSchema.index({ calculationType: 1, createdAt: -1 });
interestCalculationSchema.index({ triggeredBy: 1, createdAt: -1 });
interestCalculationSchema.index({ calculationDate: 1 });

// Static methods for common queries
interestCalculationSchema.statics.findByLoan = function(loanId: string) {
  return this.find({ loanId }).sort({ calculationDate: -1 });
};

interestCalculationSchema.statics.findByDateRange = function(startDate: Date, endDate: Date) {
  return this.find({
    calculationDate: {
      $gte: startDate,
      $lte: endDate,
    },
  }).sort({ calculationDate: -1 });
};

interestCalculationSchema.statics.findByType = function(calculationType: string) {
  return this.find({ calculationType }).sort({ calculationDate: -1 });
};

interestCalculationSchema.statics.getLatestForLoan = function(loanId: string) {
  return this.findOne({ loanId }).sort({ calculationDate: -1 });
};

// Instance methods
interestCalculationSchema.methods.toAuditSummary = function() {
  return {
    id: this._id,
    loanId: this.loanId,
    date: this.calculationDate,
    type: this.calculationType,
    trigger: this.triggeredBy,
    daysElapsed: this.daysElapsed,
    principal: this.outstandingPrincipal,
    interestAccrued: this.interestAccrued,
    totalAfter: this.totalAccruedAfter,
    capReached: this.isCapReached,
  };
};

// Pre-save validation
interestCalculationSchema.pre('save', function(next) {
  // Validate that totalAccruedAfter = totalAccruedBefore + interestAccrued (unless cap reached)
  const expectedTotal = this.totalAccruedBefore + this.interestAccrued;
  
  if (!this.isCapReached && Math.abs(this.totalAccruedAfter - expectedTotal) > 0.01) {
    return next(new Error('Interest calculation validation failed: totalAccruedAfter does not match expected value'));
  }
  
  // Validate that interest cap is not exceeded (unless explicitly marked as cap reached)
  if (this.totalAccruedAfter > this.interestCap && !this.isCapReached) {
    return next(new Error('Interest calculation validation failed: total accrued exceeds cap without cap flag'));
  }
  
  // Validate daily rate calculation
  const expectedDailyRate = (this.annualInterestRate / 100) / 365;
  if (Math.abs(this.dailyInterestRate - expectedDailyRate) > 0.00000001) {
    return next(new Error('Interest calculation validation failed: daily rate does not match annual rate'));
  }
  
  next();
});

// Create model
const InterestCalculation = mongoose.models.InterestCalculation || 
  mongoose.model<IInterestCalculation>('InterestCalculation', interestCalculationSchema);

export default InterestCalculation;

/**
 * Helper function to create interest calculation record
 */
export async function createInterestCalculationRecord(data: {
  loanId: string;
  calculationDate: Date;
  lastCalculationDate: Date;
  daysElapsed: number;
  outstandingPrincipal: number;
  annualInterestRate: number;
  dailyInterestRate: number;
  interestAccrued: number;
  totalAccruedBefore: number;
  totalAccruedAfter: number;
  interestCap: number;
  isCapReached: boolean;
  calculationType: 'daily_accrual' | 'payment_calculation' | 'default_freeze' | 'manual_adjustment';
  triggeredBy: 'cron_job' | 'payment_processing' | 'loan_disbursement' | 'admin_action' | 'simulation';
  auditTrail: string;
  metadata?: {
    paymentId?: string;
    adminUserId?: string;
    simulationId?: string;
    notes?: string;
  };
}): Promise<IInterestCalculation> {
  const calculation = new InterestCalculation(data);
  return await calculation.save();
}

/**
 * Helper function to get calculation history for a loan
 */
export async function getLoanCalculationHistory(
  loanId: string,
  limit: number = 50
): Promise<IInterestCalculation[]> {
  return await InterestCalculation.find({ loanId })
    .sort({ calculationDate: -1 })
    .limit(limit);
}

/**
 * Helper function to verify calculation integrity
 */
export async function verifyCalculationIntegrity(loanId: string): Promise<{
  isValid: boolean;
  errors: string[];
  totalCalculations: number;
}> {
  const calculations = await InterestCalculation.find({ loanId })
    .sort({ calculationDate: 1 });
  
  const errors: string[] = [];
  let previousTotal = 0;
  
  for (let i = 0; i < calculations.length; i++) {
    const calc = calculations[i];
    
    // Check if totalAccruedBefore matches previous totalAccruedAfter
    if (i > 0 && Math.abs(calc.totalAccruedBefore - previousTotal) > 0.01) {
      errors.push(`Calculation ${calc._id}: totalAccruedBefore (${calc.totalAccruedBefore}) does not match previous totalAccruedAfter (${previousTotal})`);
    }
    
    // Check if calculation is mathematically correct
    const expectedAccrued = calc.outstandingPrincipal * calc.dailyInterestRate * calc.daysElapsed;
    if (Math.abs(calc.interestAccrued - expectedAccrued) > 0.01) {
      errors.push(`Calculation ${calc._id}: interestAccrued (${calc.interestAccrued}) does not match expected (${expectedAccrued.toFixed(2)})`);
    }
    
    previousTotal = calc.totalAccruedAfter;
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    totalCalculations: calculations.length,
  };
}

