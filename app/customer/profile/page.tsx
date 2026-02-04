/**
 * Customer Profile Page
 * 
 * Allows customers to view and edit their profile information.
 * Enforces immutable field protection and provides KYC status display.
 * 
 * Data Sources:
 * - Customer profile API (/api/customer/profile)
 * - Profile update API (PUT /api/customer/profile)
 * - Real-time profile data with sensitive field masking
 * 
 * Business Logic:
 * - Displays current profile with masked sensitive data
 * - Allows editing of name, phone, and KYC fields (if not verified)
 * - Prevents modification of credit limits and trustworthy status
 * - Shows tier progression and credit building status
 * 
 * User Experience:
 * - Clean form layout with clear field labels
 * - Visual indicators for editable vs read-only fields
 * - Success/error feedback for profile updates
 * - KYC verification status display
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useProfile } from '@/lib/hooks/useCustomerApi';
import { LoadingSpinner, PageLoading } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay, FormError } from '@/components/ui/ErrorDisplay';

/**
 * Profile Form Data Interface
 */
interface ProfileFormData {
  name: string;
  phone: string;
  kyc: {
    idType: string;
    idNumber: string;
  };
}

/**
 * Customer Profile Page Component
 * 
 * Renders profile information with editable fields and KYC status.
 * Handles profile updates and provides user feedback.
 */
export default function CustomerProfilePage() {
  const { data: session, status } = useSession();
  const { data: profile, loading, error, updateProfile, refetch } = useProfile();

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    phone: '',
    kyc: {
      idType: '',
      idNumber: '',
    },
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Initialize form data when profile loads
  React.useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        phone: profile.phone,
        kyc: {
          idType: profile.kyc.idType || '',
          idNumber: profile.kyc.idNumber || '',
        },
      });
    }
  }, [profile]);

  /**
   * Validate Form Data
   * 
   * Validates profile update form against business rules.
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate name
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    } else if (formData.name.trim().length > 100) {
      errors.name = 'Name must be less than 100 characters';
    }

    // Validate phone
    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^\+675\d{8}$/.test(formData.phone.trim())) {
      errors.phone = 'Phone number must be in PNG format (+675XXXXXXXX)';
    }

    // Validate KYC fields (only if not verified)
    if (!profile?.kyc.verified) {
      if (formData.kyc.idType && !formData.kyc.idNumber.trim()) {
        errors.idNumber = 'ID number is required when ID type is selected';
      }
      if (formData.kyc.idNumber.trim() && !formData.kyc.idType) {
        errors.idType = 'ID type is required when ID number is provided';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle Form Submission
   * 
   * Submits profile updates after validation and provides user feedback.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await updateProfile({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        kyc: profile?.kyc.verified ? undefined : {
          idType: formData.kyc.idType || undefined,
          idNumber: formData.kyc.idNumber.trim() || undefined,
        },
      });

      setIsEditing(false);
      setUpdateSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (error) {
      // Error is handled by the hook and displayed in the UI
      console.error('Profile update error:', error);
    }
  };

  /**
   * Handle Cancel Edit
   * 
   * Cancels editing and resets form data to original values.
   */
  const handleCancelEdit = () => {
    if (profile) {
      setFormData({
        name: profile.name,
        phone: profile.phone,
        kyc: {
          idType: profile.kyc.idType || '',
          idNumber: profile.kyc.idNumber || '',
        },
      });
    }
    setFormErrors({});
    setIsEditing(false);
  };

  // Show loading state
  if (status === 'loading' || loading) {
    return <PageLoading />;
  }

  // Handle unauthenticated users
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">Please log in to view your profile.</p>
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

  // Handle API errors
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ErrorDisplay
            error={error}
            onRetry={refetch}
            variant="banner"
          />
        </div>
      </div>
    );
  }

  // Handle missing profile
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h1>
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
              <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
              <p className="text-gray-600">Manage your account information</p>
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
        {/* Success Message */}
        {updateSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  Profile updated successfully!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Credit Information */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Credit Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500">Current Limit</p>
              <p className="text-2xl font-bold text-indigo-600">K{profile.currentLimit}</p>
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
              <p className="text-sm text-gray-500">Account Status</p>
              <p className="text-lg font-semibold">
                <span className="text-green-600 capitalize">{profile.status}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tier Progress */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Tier Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500">On-Time Payments</p>
              <p className="text-lg font-semibold text-gray-900">
                {profile.tierInfo.onTimeCount}/2 for next tier
              </p>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full"
                  style={{ width: `${(profile.tierInfo.onTimeCount / 2) * 100}%` }}
                ></div>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Consecutive Payments</p>
              <p className="text-lg font-semibold text-gray-900">
                {profile.tierInfo.consecutiveOnTimePayments}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Path: {profile.tierInfo.trustworthyPath.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-900">Personal Information</h2>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
                >
                  Edit Profile
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                    isEditing
                      ? 'focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
                      : 'bg-gray-50 text-gray-500 cursor-not-allowed'
                  }`}
                />
                <FormError error={formErrors.name} />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={!isEditing}
                  placeholder="+675XXXXXXXX"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                    isEditing
                      ? 'focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
                      : 'bg-gray-50 text-gray-500 cursor-not-allowed'
                  }`}
                />
                <FormError error={formErrors.phone} />
              </div>

              {/* KYC Information */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  KYC Information
                  {profile.kyc.verified && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Verified
                    </span>
                  )}
                </h3>

                {/* ID Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID Type
                  </label>
                  <select
                    value={formData.kyc.idType}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      kyc: { ...prev.kyc, idType: e.target.value }
                    }))}
                    disabled={!isEditing || profile.kyc.verified}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                      isEditing && !profile.kyc.verified
                        ? 'focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
                        : 'bg-gray-50 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <option value="">Select ID type...</option>
                    <option value="national">National ID</option>
                    <option value="driver">Driver's License</option>
                    <option value="employment">Employment ID</option>
                  </select>
                  <FormError error={formErrors.idType} />
                </div>

                {/* ID Number */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID Number
                  </label>
                  <input
                    type="text"
                    value={profile.kyc.verified ? profile.kyc.idNumber || '' : formData.kyc.idNumber}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      kyc: { ...prev.kyc, idNumber: e.target.value }
                    }))}
                    disabled={!isEditing || profile.kyc.verified}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                      isEditing && !profile.kyc.verified
                        ? 'focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
                        : 'bg-gray-50 text-gray-500 cursor-not-allowed'
                    }`}
                  />
                  <FormError error={formErrors.idNumber} />
                  {profile.kyc.verified && (
                    <p className="mt-1 text-xs text-gray-500">
                      KYC information cannot be changed after verification.
                    </p>
                  )}
                </div>

                {/* KYC Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      profile.kyc.hasIdDocument ? 'bg-green-400' : 'bg-gray-300'
                    }`}></div>
                    <span>ID Document</span>
                  </div>
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      profile.kyc.hasEmploymentProof ? 'bg-green-400' : 'bg-gray-300'
                    }`}></div>
                    <span>Employment Proof</span>
                  </div>
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      profile.kyc.hasBankStatement ? 'bg-green-400' : 'bg-gray-300'
                    }`}></div>
                    <span>Bank Statement</span>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              {isEditing && (
                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Profile Information</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Your credit limit and trustworthy status are managed automatically</li>
            <li>• KYC information cannot be changed after verification</li>
            <li>• Contact support if you need to update your email address</li>
            <li>• Keep your phone number current for important notifications</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
