/**
 * Shared client-side validation & submission helper for public BUILDsmore inquiry forms.
 */

export type PublicInquiryFormSource = 'hero' | 'modal' | 'contact' | 'property_detail';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateInquiryFields(params: {
  fullName: string;
  phone: string;
  email?: string;
  emailRequired: boolean;
  message?: string;
  messageRequired?: boolean;
}): string | null {
  const name = params.fullName.trim();
  if (name.length < 2 || name.length > 100) {
    return 'Please enter your full name (at least 2 characters).';
  }
  if (/https?:\/\//i.test(name)) {
    return 'Links are not permitted in the name field.';
  }

  const phone = params.phone.trim();
  const digits = phone.replace(/\D/g, '');
  if (!phone || digits.length < 7 || digits.length > 15) {
    return 'Please enter a valid phone number (7 to 15 digits).';
  }

  const email = (params.email || '').trim();
  if (params.emailRequired && !email) {
    return 'Please provide a valid email address.';
  }
  if (email && (email.length > 160 || !EMAIL_REGEX.test(email))) {
    return 'Please enter a valid email address format (e.g. name@domain.com).';
  }

  const message = (params.message || '').trim();
  if (params.messageRequired && message.length < 5) {
    return 'Please enter a brief inquiry message (at least 5 characters).';
  }
  if (message.length > 2000) {
    return 'Message is too long. Please keep your inquiry under 2,000 characters.';
  }

  return null;
}

export interface SubmitPublicInquiryResponse {
  success: boolean;
  inquiryId?: string;
  message?: string;
  error?: string;
  emailNotification?: {
    sent: boolean;
    configured: boolean;
    recipient: string;
  };
}

export async function submitPublicInquiry(payload: {
  fullName: string;
  phone: string;
  email?: string;
  propertyId?: string;
  propertyTitle?: string;
  propertySlug?: string;
  propertyType?: string;
  budgetRange?: string;
  preferredLocation?: string;
  preferredContactMethod?: 'email' | 'phone' | 'whatsapp';
  scheduledTourDate?: string;
  sourceForm: PublicInquiryFormSource;
  message?: string;
  website?: string;
  _formStartedAt?: number;
}): Promise<SubmitPublicInquiryResponse> {
  const response = await fetch('/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as SubmitPublicInquiryResponse | null;
  if (!response.ok || !data?.success) {
    throw new Error(
      data?.error ||
        `Unable to submit inquiry (status ${response.status}). Please try again or call +91 977-987-8303.`
    );
  }

  return data;
}
