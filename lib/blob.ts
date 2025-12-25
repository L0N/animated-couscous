import { put, del } from '@vercel/blob';

/**
 * Upload payment proof to Vercel Blob
 */
export async function uploadPaymentProof(
  file: File,
  userId: string,
  loanId: string
): Promise<string> {
  try {
    const timestamp = Date.now();
    const filename = `payments/${userId}/${loanId}-${timestamp}-${file.name}`;

    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return blob.url;
  } catch (error) {
    console.error('Failed to upload payment proof:', error);
    throw new Error('File upload failed');
  }
}

/**
 * Upload KYC document to Vercel Blob
 */
export async function uploadKYCDocument(
  file: File,
  userId: string,
  documentType: string
): Promise<string> {
  try {
    const timestamp = Date.now();
    const filename = `kyc/${userId}/${documentType}-${timestamp}-${file.name}`;

    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return blob.url;
  } catch (error) {
    console.error('Failed to upload KYC document:', error);
    throw new Error('File upload failed');
  }
}

/**
 * Delete file from Vercel Blob
 */
export async function deleteFile(url: string): Promise<void> {
  try {
    await del(url);
  } catch (error) {
    console.error('Failed to delete file:', error);
    // Don't throw error - file might already be deleted
  }
}

/**
 * Validate file for upload
 */
export function validateUploadFile(file: File, maxSizeMB: number = 5): { valid: boolean; error?: string } {
  // Allowed types for payment proofs
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload JPG, PNG, or PDF',
    };
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

