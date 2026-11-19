/**
 * BUILDsmore — Server-Side SMTP Email Notification Service
 * Uses Nodemailer with strictly environment-variable-driven SMTP configuration.
 * Never hardcodes credentials and always sanitizes HTML / header values.
 */

import nodemailer, { Transporter } from 'nodemailer';
import { getServerConfig, isSmtpConfigured, DEFAULT_INQUIRY_NOTIFY_EMAIL } from './config';
import type { ValidatedInquiryPayload } from './security';

export interface EmailSendResult {
  sent: boolean;
  configured: boolean;
  recipient: string;
  messageId?: string;
  error?: string;
}

let cachedTransporter: Transporter | null = null;
let cachedTransportKey = '';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHeaderInjection(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').trim();
}

function getSmtpTransporter(): Transporter | null {
  const config = getServerConfig();
  if (!isSmtpConfigured(config.smtp)) {
    return null;
  }

  const key = `${config.smtp.host}:${config.smtp.port}:${config.smtp.secure}:${config.smtp.user}`;
  if (!cachedTransporter || cachedTransportKey !== key) {
    cachedTransporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    cachedTransportKey = key;
  }

  return cachedTransporter;
}

export function getEmailNotificationStatus(): {
  configured: boolean;
  recipient: string;
  missingVariables: string[];
} {
  const config = getServerConfig();
  const missing: string[] = [];
  if (!config.smtp.host) missing.push('SMTP_HOST');
  if (!config.smtp.port) missing.push('SMTP_PORT');
  if (!config.smtp.user || config.smtp.user.includes('YOUR_')) missing.push('SMTP_USER');
  if (!config.smtp.pass || config.smtp.pass.includes('YOUR_')) missing.push('SMTP_PASS');

  return {
    configured: isSmtpConfigured(config.smtp),
    recipient: config.smtp.notifyTo || DEFAULT_INQUIRY_NOTIFY_EMAIL,
    missingVariables: missing,
  };
}

/**
 * Sends a notification email to buildsmore66@gmail.com (or configured INQUIRY_NOTIFY_EMAIL)
 * whenever a valid public inquiry/contact form is submitted.
 */
export async function sendInquiryNotificationEmail(params: {
  inquiryId: string;
  createdAt: string;
  payload: ValidatedInquiryPayload;
}): Promise<EmailSendResult> {
  const config = getServerConfig();
  const recipient = config.smtp.notifyTo || DEFAULT_INQUIRY_NOTIFY_EMAIL;
  const transporter = getSmtpTransporter();

  if (!transporter) {
    return {
      sent: false,
      configured: false,
      recipient,
      error: 'SMTP server credentials are not configured in environment variables.',
    };
  }

  const { inquiryId, createdAt, payload } = params;
  const safeName = stripHeaderInjection(payload.fullName);
  const safeSubjectTarget = stripHeaderInjection(
    payload.propertyTitle || payload.propertyType || 'General Advisory'
  );
  const subject = `[BUILDsmore Lead] New Inquiry from ${safeName} — ${safeSubjectTarget}`;

  const sourceLabels: Record<string, string> = {
    hero: 'Homepage Hero Inquiry Form',
    modal: 'Private Inquiry Popup Modal',
    contact: 'Contact & Consultation Page',
    property_detail: 'Property Detail Page Form',
    api: 'Direct Inquiry API',
  };
  const sourceLabel = sourceLabels[payload.sourceForm] || payload.sourceForm;

  const textLines = [
    'BUILDsmore Real Estate — New Client Inquiry Notification',
    '======================================================',
    `Inquiry ID:       ${inquiryId}`,
    `Submitted At:     ${createdAt}`,
    `Source Form:      ${sourceLabel}`,
    '',
    'CLIENT DETAILS',
    `Full Name:        ${payload.fullName}`,
    `Phone Number:     ${payload.phone}`,
    `Email Address:    ${payload.clientEmailProvided ? payload.email : 'Not provided'}`,
    `Preferred Contact:${payload.preferredContactMethod}`,
    '',
    'REQUIREMENTS',
    `Target Property:  ${payload.propertyTitle || 'Not specified'}`,
    `Property Type:    ${payload.propertyType}`,
    `Budget Range:     ${payload.budgetRange}`,
    `Location Pref:    ${payload.preferredLocation || 'Not specified'}`,
    `Tour Date:        ${payload.scheduledTourDate || 'Flexible'}`,
    '',
    'MESSAGE / NOTES:',
    payload.message,
  ];

  const htmlBody = `
    <div style="font-family: Arial, Helvetica, sans-serif; background:#0c0f12; color:#f7f5f2; padding:24px; max-width:640px; margin:0 auto; border:1px solid #242b35;">
      <div style="border-bottom:2px solid #c5a059; padding-bottom:12px; margin-bottom:20px;">
        <h2 style="margin:0; color:#c5a059; font-size:20px; letter-spacing:1px;">BUILDsmore — New Client Inquiry</h2>
        <p style="margin:4px 0 0; color:#9ca3af; font-size:12px;">Reference: ${escapeHtml(inquiryId)} · Source: ${escapeHtml(sourceLabel)}</p>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:13px; line-height:1.5;">
        <tr><td style="padding:6px 0; color:#9ca3af; width:160px;">Client Name</td><td style="padding:6px 0; color:#ffffff; font-weight:bold;">${escapeHtml(payload.fullName)}</td></tr>
        <tr><td style="padding:6px 0; color:#9ca3af;">Phone</td><td style="padding:6px 0; color:#c5a059; font-weight:bold;">${escapeHtml(payload.phone)}</td></tr>
        <tr><td style="padding:6px 0; color:#9ca3af;">Email</td><td style="padding:6px 0; color:#ffffff;">${escapeHtml(payload.clientEmailProvided ? payload.email : 'Not provided')}</td></tr>
        <tr><td style="padding:6px 0; color:#9ca3af;">Preferred Channel</td><td style="padding:6px 0; color:#ffffff;">${escapeHtml(payload.preferredContactMethod)}</td></tr>
        <tr><td style="padding:6px 0; color:#9ca3af;">Target Property</td><td style="padding:6px 0; color:#ffffff;">${escapeHtml(payload.propertyTitle || 'General Portfolio Inquiry')}</td></tr>
        <tr><td style="padding:6px 0; color:#9ca3af;">Property Type</td><td style="padding:6px 0; color:#ffffff;">${escapeHtml(payload.propertyType)}</td></tr>
        <tr><td style="padding:6px 0; color:#9ca3af;">Budget Range</td><td style="padding:6px 0; color:#ffffff;">${escapeHtml(payload.budgetRange)}</td></tr>
        <tr><td style="padding:6px 0; color:#9ca3af;">Preferred Location</td><td style="padding:6px 0; color:#ffffff;">${escapeHtml(payload.preferredLocation || 'Not specified')}</td></tr>
        <tr><td style="padding:6px 0; color:#9ca3af;">Inspection Date</td><td style="padding:6px 0; color:#ffffff;">${escapeHtml(payload.scheduledTourDate || 'Flexible')}</td></tr>
      </table>
      <div style="margin-top:18px; padding:14px; background:#14181f; border:1px solid #242b35;">
        <div style="font-size:11px; text-transform:uppercase; color:#c5a059; margin-bottom:6px;">Message</div>
        <div style="font-size:13px; color:#e5e7eb; white-space:pre-wrap;">${escapeHtml(payload.message)}</div>
      </div>
      <p style="margin-top:18px; font-size:11px; color:#6b7280;">Submitted at ${escapeHtml(createdAt)} via ${escapeHtml(config.appUrl)}</p>
    </div>
  `;

  try {
    const fromAddress = config.smtp.from || config.smtp.user;
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      ...(payload.clientEmailProvided ? { replyTo: stripHeaderInjection(payload.email) } : {}),
      subject,
      text: textLines.join('\n'),
      html: htmlBody,
    });

    return {
      sent: true,
      configured: true,
      recipient,
      messageId: info.messageId,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Mailer Error] Failed to deliver inquiry notification:', errMsg);
    return {
      sent: false,
      configured: true,
      recipient,
      error: 'Email delivery failed via SMTP transport.',
    };
  }
}
