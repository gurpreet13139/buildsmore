import React, { useState, useEffect, useRef } from 'react';
import { PhoneCall, Tag, Car, X, CheckCircle2, Shield, Phone, Mail, User, AlertCircle } from 'lucide-react';
import { storage } from '../../services/storage';
import { submitPublicInquiry, validateInquiryFields } from '../../utils/inquiryValidation';

interface PrivateInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyTitle?: string;
}

export const PrivateInquiryModal: React.FC<PrivateInquiryModalProps> = ({
  isOpen,
  onClose,
  propertyTitle,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const formStartedAt = useRef<number>(Date.now());
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      formStartedAt.current = Date.now();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const validationError = validateInquiryFields({
      fullName: name,
      phone,
      email,
      emailRequired: false,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    setLoading(true);
    setError('');

    try {
      const msg = `[Private Inquiry Popup] Avail Best Offers & Instant Call Back. Registered phone: ${trimmedPhone}`;
      const data = await submitPublicInquiry({
        fullName: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail || undefined,
        propertyTitle: propertyTitle || 'BUILDsmore Portfolio Consultation',
        preferredContactMethod: 'phone',
        sourceForm: 'modal',
        message: msg,
        website: honeypot,
        _formStartedAt: formStartedAt.current,
      });

      storage.createInquiry({
        clientName: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail || 'Not provided',
        preferredContactMethod: 'phone',
        propertyTitle: propertyTitle || 'BUILDsmore Portfolio Consultation',
        message: msg,
      });

      setSuccessNote(data.message || null);
      setSubmitted(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit inquiry right now. Please call +91 977-987-8303.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setName('');
    setPhone('');
    setEmail('');
    setHoneypot('');
    setSuccessNote(null);
    setError('');
    formStartedAt.current = Date.now();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={handleResetAndClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inquiry-modal-title"
    >
      {/* Modal Dialog Card Styled to match BUILDsmore's dark luxury gold aesthetic */}
      <div
        className="relative w-full max-w-[450px] bg-[#12161c] border border-[#263140] text-[#f7f5f2] rounded-xl shadow-2xl p-6 sm:p-7 space-y-5 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Close Button */}
        <button
          onClick={handleResetAndClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-[#f7f5f2] p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 1. Official Emblem & Wordmark */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img
              src="/assets/aistudio/logo-builds_more_aa2f07ab.jpeg"
              alt="BUILDsmore Logo"
              className="h-11 w-11 rounded-sm object-cover border border-[#c5a059]/40 shadow-sm"
            />
            <div className="text-left">
              <span className="font-serif text-xl sm:text-2xl tracking-[0.14em] font-medium text-[#f7f5f2] uppercase leading-none block">
                BUILDsmore
              </span>
              <span className="text-[9px] font-mono tracking-[0.2em] text-[#c5a059] uppercase block font-semibold mt-1">
                Let's Grow Together
              </span>
            </div>
          </div>
        </div>

        {/* 2. Headline Title */}
        <div className="text-center">
          <h3
            id="inquiry-modal-title"
            className="font-serif text-xl sm:text-2xl font-normal text-[#f7f5f2] tracking-normal leading-snug"
          >
            Register here and Avail the Best Offers!!
          </h3>
          <p className="text-xs text-[#9ca3af] mt-1.5 leading-relaxed">
            Exclusive access to prime holdings, early bird valuations & priority site visits.
          </p>
        </div>

        {/* 3. Highlight Badges Box (Instant Call Back, Unmatched Price, Free Site Visit) */}
        <div className="border border-[#c5a059]/25 bg-[#171d26]/85 rounded-lg p-3.5 grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="w-9 h-9 rounded-full bg-[#c5a059]/15 border border-[#c5a059]/30 text-[#c5a059] flex items-center justify-center mb-1.5 shadow-xs mx-auto">
              <PhoneCall className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-[#e5e7eb] leading-tight">
              Instant Call Back
            </span>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="w-9 h-9 rounded-full bg-[#c5a059]/15 border border-[#c5a059]/30 text-[#c5a059] flex items-center justify-center mb-1.5 shadow-xs mx-auto">
              <Tag className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-[#e5e7eb] leading-tight">
              Unmatched Price
            </span>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="w-9 h-9 rounded-full bg-[#c5a059]/15 border border-[#c5a059]/30 text-[#c5a059] flex items-center justify-center mb-1.5 shadow-xs mx-auto">
              <Car className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-[#e5e7eb] leading-tight">
              Free Site Visit
            </span>
          </div>
        </div>

        {/* 4. Form / Submission View */}
        {submitted ? (
          <div className="py-6 px-4 bg-[#171d26] border border-[#c5a059]/40 rounded-lg text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#c5a059] mx-auto animate-bounce" />
            <h4 className="font-serif text-2xl font-normal text-[#f7f5f2]">
              Registration Successful!
            </h4>
            <p className="text-xs text-[#9ca3af] leading-relaxed max-w-xs mx-auto">
              Thank you, <strong className="text-[#f7f5f2] font-semibold">{name}</strong>.{' '}
              {successNote ||
                `Our senior property advisor will call you at ${phone} with the best available offers.`}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-6 py-2.5 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs font-semibold uppercase tracking-[0.15em] rounded-sm transition-colors cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="modal-website-field">Website</label>
              <input
                id="modal-website-field"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            {error && (
              <div role="alert" className="p-2.5 bg-red-950/60 border border-red-500/40 text-red-300 text-xs rounded-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Name Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#c5a059]/80">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name *"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#171d26] border border-[#2a3443] focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] rounded-sm text-sm text-[#f7f5f2] placeholder-[#6b7280] focus:outline-none transition-all shadow-xs"
              />
            </div>

            {/* Phone Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#c5a059]/80">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone *"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#171d26] border border-[#2a3443] focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] rounded-sm text-sm text-[#f7f5f2] placeholder-[#6b7280] focus:outline-none transition-all shadow-xs"
              />
            </div>

            {/* Email Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#c5a059]/80">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (Optional)"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#171d26] border border-[#2a3443] focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] rounded-sm text-sm text-[#f7f5f2] placeholder-[#6b7280] focus:outline-none transition-all shadow-xs"
              />
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#c5a059] hover:bg-[#d4af5f] active:bg-[#b38e47] text-[#0c0f12] font-semibold text-xs uppercase tracking-[0.15em] rounded-sm transition-all shadow-md hover:shadow-[#c5a059]/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              <span>{loading ? 'Submitting...' : 'Send'}</span>
            </button>

            {/* Footer reassurance */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#8a909a] pt-1">
              <Shield className="w-3.5 h-3.5 text-[#c5a059]" />
              <span>100% Confidential · Direct Support: 977-987-8303</span>
            </div>
          </form>
        )}

        {/* Bottom Circular Close Button */}
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-8 h-8 rounded-full border border-[#2a3443] text-gray-400 hover:text-[#f7f5f2] hover:border-[#c5a059] hover:bg-white/5 flex items-center justify-center text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
