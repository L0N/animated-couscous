/**
 * Customer Payment Upload Page
 * 
 * Allows customers to upload payment proof for loan verification.
 * Supports file validation, loan selection, and payment amount entry.
 * 
 * Data Sources:
 * - Customer active loans for loan selection
 * - Payment upload API (/api/customer/payments/upload)
 * - File validation and secure upload
 * 
 * Business Logic:
 * - Only shows disbursed loans with remaining balance
 * - Validates payment amount against remaining balance
 * - Supports multiple file formats (images, PDFs)
 * - Provides upload progress and status feedback
 * 
 * User Experience:
 * - Drag-and-drop file upload interface
 * - Real-time file validation feedback
 * - Clear payment amount validation
 * - Success confirmation with next steps
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { usePaymentUpload, useLoanHistory } from '@/lib/hooks/useCustomerApi';
import { LoadingSpinner, PageLoading } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay, FormError } from '@/components/ui/ErrorDisplay';

/**
 * Payment Upload Form Data Interface
 */
interface PaymentFormData {
  loanId: string;
  amount: number;
  description: string;
  file: File | null;
}

/**
 * Customer Payment Upload Page Component
 * 
 * Renders payment upload form with file validation and loan selection.
 * Handles form submission and provides feedback to the user.
 */
export default function PaymentUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { data: loanData, loading: loansLoading } = useLoanHistory(1, 50); // Get all loans
  const { uploadPayment, loading: uploading, error: uploadError } = usePaymentUpload();

  // Form state
  const [formData, setFormData] = useState<PaymentFormData>({
    loanId: searchParams?.get('loanId') || '',
    amount: 0,
    description: '',
    file: null,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Get eligible loans (disbursed with remaining balance)
  const eligibleLoans = loanData?.loans?.filter(
    loan => loan.status === 'disbursed' && loan.remainingBalance > 0
  ) || [];

  // Get selected loan details
  const selectedLoan = eligibleLoans.find(loan => loan.id === formData.loanId);

  /**
   * Validate File
   * 
   * Validates uploaded file against size and type requirements.
   */
  const validateFile = (file: File): string | null => {
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return 'File size must be less than 10MB';
    }

    // Check file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
    if (!allowedTypes.includes(file.type)) {
      return 'File must be an image (JPEG, PNG, WebP) or PDF';
    }

    return null;
  };

  /**
   * Handle File Selection
   * 
   * Processes file selection from input or drag-and-drop.
   */
  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setFormErrors(prev => ({ ...prev, file: error }));
      return;
    }

    setFormData(prev => ({ ...prev, file }));
    setFormErrors(prev => ({ ...prev, file: '' }));

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  /**
   * Handle Drag Events
   * 
   * Manages drag-and-drop file upload interface.
   */
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  /**
   * Validate Form Data
   * 
   * Validates payment upload form against business rules.
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate loan selection
    if (!formData.loanId) {
      errors.loanId = 'Please select a loan';
    } else if (!selectedLoan) {
      errors.loanId = 'Selected loan is not valid';
    }

    // Validate amount
    if (formData.amount <= 0) {
      errors.amount = 'Payment amount must be greater than 0';
    } else if (selectedLoan && formData.amount > selectedLoan.remainingBalance) {
      errors.amount = `Amount cannot exceed remaining balance of K${selectedLoan.remainingBalance.toFixed(2)}`;
    }

    // Validate file
    if (!formData.file) {
      errors.file = 'Please upload payment proof';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle Form Submission
   * 
   * Submits payment upload after validation and provides user feedback.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const result = await uploadPayment(
        formData.file!,
        formData.loanId,
        formData.amount,
        formData.description || undefined
      );

      // Show success message and redirect to dashboard
      router.push(`/customer/dashboard?success=payment-uploaded&paymentId=${result.paymentId}`);
    } catch (error) {
      // Error is handled by the hook and displayed in the UI
      console.error('Payment upload error:', error);
    }
  };

  // Show loading state
  if (status === 'loading' || loansLoading) {
    return <PageLoading />;
  }

  // Handle unauthenticated users
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Please log in to upload payment proof.</p>
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

  // Handle no eligible loans
  if (eligibleLoans.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Upload Payment</h1>
                <p className="text-gray-600">Submit payment proof for verification</p>
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

        <main className="max-w-3xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg">
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No loans available for payment</h3>
              <p className="mt-1 text-sm text-gray-500">
                You don't have any disbursed loans that require payment.
              </p>
              <div className="mt-6">
                <Link
                  href="/customer/loans"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  View Loan History
                </Link>
              </div>
            </div>
          </div>
        </main>
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
              <h1 className="text-3xl font-bold text-gray-900">Upload Payment</h1>
              <p className="text-gray-600">Submit payment proof for verification</p>
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
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Loan Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Loan
                </label>
                <select
                  value={formData.loanId}
                  onChange={(e) => setFormData(prev => ({ ...prev, loanId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Choose a loan...</option>
                  {eligibleLoans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.reference} - K{loan.remainingBalance.toFixed(2)} remaining
                    </option>
                  ))}
                </select>
                <FormError error={formErrors.loanId} />
              </div>

              {/* Loan Details */}
              {selectedLoan && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Loan Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Reference:</span>
                      <span className="ml-2 font-medium">{selectedLoan.reference}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Original Amount:</span>
                      <span className="ml-2 font-medium">K{selectedLoan.amount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Due Date:</span>
                      <span className="ml-2 font-medium">
                        {new Date(selectedLoan.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Remaining Balance:</span>
                      <span className="ml-2 font-medium text-red-600">
                        K{selectedLoan.remainingBalance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Amount (Kina)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={selectedLoan?.remainingBalance || undefined}
                  value={formData.amount || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter payment amount"
                />
                {selectedLoan && (
                  <p className="mt-1 text-sm text-gray-500">
                    Maximum: K{selectedLoan.remainingBalance.toFixed(2)}
                  </p>
                )}
                <FormError error={formErrors.amount} />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Proof
                </label>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                    dragActive
                      ? 'border-indigo-500 bg-indigo-50'
                      : formData.file
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  {formData.file ? (
                    <div className="text-center">
                      {filePreview ? (
                        <img
                          src={filePreview}
                          alt="Payment proof preview"
                          className="mx-auto h-32 w-32 object-cover rounded-lg mb-4"
                        />
                      ) : (
                        <svg
                          className="mx-auto h-12 w-12 text-green-400 mb-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                      <p className="text-sm font-medium text-gray-900">{formData.file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(formData.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, file: null }));
                          setFilePreview(null);
                        }}
                        className="mt-2 text-sm text-red-600 hover:text-red-500"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="mt-4">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-indigo-600">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">
                          Images (JPEG, PNG, WebP) or PDF up to 10MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <FormError error={formErrors.file} />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Add any additional notes about this payment..."
                />
              </div>

              {/* Error Display */}
              {uploadError && (
                <ErrorDisplay
                  error={uploadError}
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
                  disabled={uploading || !formData.file || !formData.loanId || formData.amount <= 0}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <LoadingSpinner size="sm" color="white" className="mr-2" />
                      Uploading...
                    </>
                  ) : (
                    'Upload Payment Proof'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Payment Instructions</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Upload a clear photo or scan of your payment receipt</li>
            <li>• Ensure the payment amount and date are visible</li>
            <li>• Your payment will be verified within 24 hours</li>
            <li>• You'll receive an email confirmation once verified</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
