/**
 * Customer Loan Application Page
 * 
 * Allows customers to apply for loans within their tier limits.
 * Provides real-time interest calculation and loan preview.
 * 
 * Data Sources:
 * - Customer profile for current limit and eligibility
 * - Loan application API (/api/customer/apply)
 * - Real-time interest calculation
 * 
 * Business Logic:
 * - Enforces tier-based loan limits
 * - Calculates interest based on amount and term
 * - Validates customer eligibility before submission
 * - Provides clear loan terms and repayment information
 * 
 * User Experience:
 * - Interactive amount slider with tier limit
 * - Term selection with interest preview
 * - Clear loan summary before submission
 * - Success/error feedback with next steps
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLoanApplication, useProfile } from '@/lib/hooks/useCustomerApi';
import { LoadingSpinner, PageLoading } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay, FormError } from '@/components/ui/ErrorDisplay';

/**
 * Loan Application Form Data Interface
 */
interface LoanFormData {
  amount: number;
  termDays: number;
}

/**
 * Interest Calculation Interface
 */
interface InterestCalculation {
  interestRate: number;
  interestAmount: number;
  totalRepayable: number;
  dueDate: string;
}

/**
 * Customer Loan Application Page Component
 * 
 * Renders loan application form with real-time calculations and validation.
 * Handles form submission and provides feedback to the user.
 */
export default function LoanApplicationPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { data: profile, loading: profileLoading } = useProfile();
  const { applyForLoan, loading: submitting, error: submitError } = useLoanApplication();

  // Form state
  const [formData, setFormData] = useState<LoanFormData>({
    amount: 50,
    termDays: 14,
  });
  const [calculation, setCalculation] = useState<InterestCalculation | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isCalculating, setIsCalculating] = useState(false);

  // Available loan terms (in days)
  const availableTerms = [14, 30, 60, 90];

  /**
   * Calculate Interest and Total Repayable
   * 
   * Simulates the backend interest calculation logic for real-time preview.
   * In a production system, this would call a dedicated calculation endpoint.
   */
  const calculateInterest = async (amount: number, termDays: number) => {
    setIsCalculating(true);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Basic interest calculation (simplified version of backend logic)
      // In production, this should call an API endpoint for accurate calculation
      const baseRates: Record<number, number> = {
        14: 0.30,  // 30%
        30: 0.60,  // 60%
        60: 0.75,  // 75%
        90: 1.00,  // 100%
      };
      
      const baseRate = baseRates[termDays] || 0.30;
      let finalRate = baseRate;
      
      // Apply trustworthy discount if applicable
      if (profile?.isTrustworthy) {
        const discountPercentage = Math.floor((baseRate * 100 / 6) / 5) * 5;
        finalRate = baseRate - (discountPercentage / 100);
      }
      
      const interestAmount = amount * finalRate;
      const totalRepayable = amount + interestAmount;
      
      // Calculate due date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + termDays);
      
      setCalculation({
        interestRate: finalRate,
        interestAmount,
        totalRepayable,
        dueDate: dueDate.toISOString(),
      });
    } catch (error) {
      console.error('Interest calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  /**
   * Validate Form Data
   * 
   * Validates loan application form against business rules and user limits.
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Validate amount
    if (formData.amount < 50) {
      errors.amount = 'Minimum loan amount is K50';
    } else if (profile && formData.amount > profile.currentLimit) {
      errors.amount = `Amount exceeds your current limit of K${profile.currentLimit}`;
    }
    
    // Validate term
    if (!availableTerms.includes(formData.termDays)) {
      errors.termDays = 'Please select a valid loan term';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle Form Submission
   * 
   * Submits loan application after validation and provides user feedback.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      const result = await applyForLoan(formData);
      
      // Show success message and redirect to dashboard
      router.push(`/customer/dashboard?success=loan-applied&reference=${result.reference}`);
    } catch (error) {
      // Error is handled by the hook and displayed in the UI
      console.error('Loan application error:', error);
    }
  };

  /**
   * Handle Amount Change
   * 
   * Updates amount and recalculates interest when slider value changes.
   */
  const handleAmountChange = (newAmount: number) => {
    setFormData(prev => ({ ...prev, amount: newAmount }));
    if (newAmount >= 50 && profile && newAmount <= profile.currentLimit) {
      calculateInterest(newAmount, formData.termDays);
    }
  };

  /**
   * Handle Term Change
   * 
   * Updates term and recalculates interest when term selection changes.
   */
  const handleTermChange = (newTerm: number) => {
    setFormData(prev => ({ ...prev, termDays: newTerm }));
    if (formData.amount >= 50 && profile && formData.amount <= profile.currentLimit) {
      calculateInterest(formData.amount, newTerm);
    }
  };

  // Calculate initial interest when profile loads
  useEffect(() => {
    if (profile && formData.amount >= 50 && formData.amount <= profile.currentLimit) {
      calculateInterest(formData.amount, formData.termDays);
    }
  }, [profile]);

  // Show loading state
  if (status === 'loading' || profileLoading) {
    return <PageLoading />;
  }

  // Handle unauthenticated users
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Please log in to apply for a loan.</p>
          <Link
            href="/"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Handle missing profile
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile Required</h1>
          <p className="text-gray-600 mb-4">Unable to load your profile information.</p>
          <Link
            href="/customer/dashboard"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Apply for Loan</h1>
              <p className="text-gray-600">Get quick access to funds</p>
            </div>
            <Link
              href="/customer/dashboard"
              className="text-indigo-600 hover:text-indigo-500 font-medium"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Profile Summary */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Your Loan Eligibility</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Current Limit</p>
              <p className="text-lg font-semibold text-gray-900">K{profile.currentLimit}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="text-lg font-semibold">
                {profile.isTrustworthy ? (
                  <span className="text-green-600">Trustworthy</span>
                ) : (
                  <span className="text-yellow-600">Building Credit</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Interest Discount</p>
              <p className="text-lg font-semibold">
                {profile.isTrustworthy ? (
                  <span className="text-green-600">Available</span>
                ) : (
                  <span className="text-gray-600">Not Available</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Application Form */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Amount Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loan Amount
                </label>
                <div className="space-y-4">
                  <div>
                    <input
                      type="range"
                      min="50"
                      max={profile.currentLimit}
                      step="10"
                      value={formData.amount}
                      onChange={(e) => handleAmountChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                      <span>K50</span>
                      <span>K{profile.currentLimit}</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-bold text-indigo-600">K{formData.amount}</span>
                  </div>
                </div>
                <FormError error={formErrors.amount} />
              </div>

              {/* Term Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loan Term
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {availableTerms.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleTermChange(term)}
                      className={`p-3 text-center border rounded-lg transition-colors ${
                        formData.termDays === term
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-medium">{term} days</div>
                      <div className="text-sm text-gray-500">
                        {term === 14 ? '2 weeks' : 
                         term === 30 ? '1 month' : 
                         term === 60 ? '2 months' : '3 months'}
                      </div>
                    </button>
                  ))}
                </div>
                <FormError error={formErrors.termDays} />
              </div>

              {/* Loan Summary */}
              {calculation && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Loan Summary</h3>
                  {isCalculating ? (
                    <div className="flex items-center justify-center py-4">
                      <LoadingSpinner size="sm" />
                      <span className="ml-2 text-sm text-gray-600">Calculating...</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Loan Amount:</span>
                        <span className="font-medium">K{formData.amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Interest Rate:</span>
                        <span className="font-medium">{(calculation.interestRate * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Interest Amount:</span>
                        <span className="font-medium">K{calculation.interestAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-900 font-medium">Total Repayable:</span>
                        <span className="font-bold text-lg">K{calculation.totalRepayable.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Due Date:</span>
                        <span className="font-medium">
                          {new Date(calculation.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                      {profile.isTrustworthy && (
                        <div className="text-sm text-green-600 mt-2">
                          ✓ Trustworthy discount applied
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {submitError && (
                <ErrorDisplay
                  error={submitError}
                  variant="card"
                />
              )}

              {/* Submit Button */}
              <div className="flex justify-end space-x-3">
                <Link
                  href="/customer/dashboard"
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting || isCalculating || !calculation}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner size="sm" color="white" className="mr-2" />
                      Submitting...
                    </>
                  ) : (
                    'Apply for Loan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            By applying for a loan, you agree to our{' '}
            <a href="#" className="text-indigo-600 hover:text-indigo-500">
              Terms and Conditions
            </a>{' '}
            and{' '}
            <a href="#" className="text-indigo-600 hover:text-indigo-500">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
