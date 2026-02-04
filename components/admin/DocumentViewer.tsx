/**
 * Document Viewer Component
 * 
 * Displays customer KYC documents and loan-related files for admin review.
 * Provides secure document viewing with download capabilities.
 * 
 * Business Rules:
 * - KYC verification status affects loan approval eligibility
 * - Documents must be viewable for compliance verification
 * - Secure access to sensitive customer documents
 * 
 * Data Flow:
 * 1. Display customer KYC document status and types
 * 2. Provide secure links to view/download documents
 * 3. Show document verification status and timestamps
 * 4. Handle missing or incomplete documentation gracefully
 */

'use client';

import { useState } from 'react';
import { AdminCustomerData } from '@/lib/hooks/useAdminApi';
import { 
  DocumentTextIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface DocumentViewerProps {
  customer: AdminCustomerData;
  loanId: string;
}

interface DocumentItem {
  type: string;
  label: string;
  url?: string;
  status: 'verified' | 'pending' | 'missing';
  uploadedAt?: string;
  verifiedAt?: string;
}

export default function DocumentViewer({ customer, loanId }: DocumentViewerProps) {
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not available';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDocuments = (): DocumentItem[] => {
    const documents: DocumentItem[] = [];
    
    if (customer.kyc) {
      // ID Document
      if (customer.kyc.idType) {
        documents.push({
          type: 'id',
          label: `${customer.kyc.idType.charAt(0).toUpperCase() + customer.kyc.idType.slice(1)} ID`,
          url: customer.kyc.idDocument,
          status: customer.kyc.verified ? 'verified' : 'pending',
          uploadedAt: customer.kyc.uploadedAt,
          verifiedAt: customer.kyc.verifiedAt,
        });
      }

      // Employment Proof
      documents.push({
        type: 'employment',
        label: 'Employment Proof',
        url: customer.kyc.employmentProof,
        status: customer.kyc.employmentProof 
          ? (customer.kyc.verified ? 'verified' : 'pending')
          : 'missing',
        uploadedAt: customer.kyc.uploadedAt,
        verifiedAt: customer.kyc.verifiedAt,
      });

      // Bank Statement
      documents.push({
        type: 'bank',
        label: 'Bank Statement',
        url: customer.kyc.bankStatement,
        status: customer.kyc.bankStatement 
          ? (customer.kyc.verified ? 'verified' : 'pending')
          : 'missing',
        uploadedAt: customer.kyc.uploadedAt,
        verifiedAt: customer.kyc.verifiedAt,
      });
    }

    return documents;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'pending':
        return <ClockIcon className="w-5 h-5 text-yellow-600" />;
      case 'missing':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />;
      default:
        return <DocumentTextIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'missing':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const handleViewDocument = (url: string) => {
    // In a real implementation, this would open a secure document viewer
    // For now, we'll open in a new tab
    window.open(url, '_blank');
  };

  const handleDownloadDocument = (url: string, filename: string) => {
    // In a real implementation, this would trigger a secure download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const documents = getDocuments();
  const overallKycStatus = customer.kyc?.verified ? 'verified' : 'pending';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">KYC Documents</h2>
        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(overallKycStatus)}`}>
          {overallKycStatus === 'verified' ? 'Verified' : 'Pending Verification'}
        </div>
      </div>

      {/* Overall KYC Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          {getStatusIcon(overallKycStatus)}
          <span className="text-sm font-medium text-gray-900">
            KYC Verification Status
          </span>
        </div>
        <p className="text-sm text-gray-600">
          {customer.kyc?.verified 
            ? `Verified on ${formatDate(customer.kyc.verifiedAt)}`
            : 'Pending admin verification'
          }
        </p>
        {customer.kyc?.idNumber && (
          <p className="text-xs text-gray-500 mt-1">
            ID Number: {customer.kyc.idNumber}
          </p>
        )}
      </div>

      {/* Document List */}
      <div className="space-y-3">
        {documents.length === 0 ? (
          <div className="text-center py-8">
            <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No KYC documents available</p>
          </div>
        ) : (
          documents.map((doc, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(doc.status)}
                  <div>
                    <p className="font-medium text-gray-900">{doc.label}</p>
                    <p className="text-sm text-gray-600">
                      {doc.status === 'missing' 
                        ? 'Not uploaded'
                        : `Uploaded: ${formatDate(doc.uploadedAt)}`
                      }
                    </p>
                    {doc.verifiedAt && (
                      <p className="text-xs text-green-600">
                        Verified: {formatDate(doc.verifiedAt)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {doc.url && doc.status !== 'missing' && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewDocument(doc.url!)}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Document"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDownloadDocument(doc.url!, `${doc.label}-${customer.name}`)}
                      className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                      title="Download Document"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                  {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Verification Actions */}
      {!customer.kyc?.verified && documents.some(doc => doc.status === 'pending') && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Verification Required
          </h4>
          <p className="text-sm text-blue-800 mb-3">
            Review all uploaded documents before approving the loan application.
          </p>
          <div className="flex space-x-3">
            <button className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors">
              Verify KYC
            </button>
            <button className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors">
              Request More Documents
            </button>
          </div>
        </div>
      )}

      {/* Document Security Notice */}
      <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          <strong>Security Notice:</strong> All documents are encrypted and stored securely. 
          Access is logged for compliance and audit purposes.
        </p>
      </div>
    </div>
  );
}
