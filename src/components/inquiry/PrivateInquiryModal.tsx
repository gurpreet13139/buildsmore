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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1F4B]/70 backdrop-blur-sm animate-fade-in"
      onClick={handleResetAndClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inquiry-modal-title"
    >
      {/* Modal Dialog Card in White + Royal Blue + Red aesthetic */}
      <div
        className="relative w-full max-w-[460px] bg-white border border-slate-200 text-[#0D2558] rounded-2xl shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Royal Blue Top Header Strip with Framed Black-and-Gold Logo */}
        <div className="bg-[#0D2558] px-6 py-5 text-white relative">
          <button
            onClick={handleResetAndClose}
            className="absolute top-4 right-4 text-slate-300 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center justify-center gap-3">
            <div className="p-0.5 rounded-lg bg-[#0c0f12] border border-[#c5a059]/60 shadow-sm shrink-0">
              <img
                src="/assets/aistudio/logo-builds_more_aa2f07ab.jpeg"
                alt="BUILDsmore Logo"
                className="h-10 w-10 rounded-md object-cover block"
              />
            </div>
            <div className="text-left">
              <span className="text-xl tracking-tight font-extrabold text-white leading-none block">
                BUILDsmore
              </span>
              <span className="text-[10px] tracking-[0.14em] text-sky-200 uppercase block font-semibold mt-1">
                Let&apos;s Grow Together
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          {/* 2. Headline Title */}
          <div className="text-center">
            <h3
              id="inquiry-modal-title"
              className="text-xl sm:text-2xl font-extrabold text-[#0D2558] tracking-tight leading-snug"
            >
              Register here and Avail the Best Offers!!
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Exclusive access to prime holdings, early bird valuations &amp; priority site visits.
            </p>
          </div>

          {/* 3. Highlight Badges Box */}
          <div className="border border-slate-200 bg-[#F7F9FC] rounded-xl p-3.5 grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-[#EEF3FB] text-[#163B8C] flex items-center justify-center mb-1.5 mx-auto">
                <PhoneCall className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-[#0D2558] leading-tight">
                Instant Call Back
              </span>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-red-50 text-[#DC1F26] flex items-center justify-center mb-1.5 mx-auto">
                <Tag className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-[#0D2558] leading-tight">
                Unmatched Price
              </span>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-[#EEF3FB] text-[#163B8C] flex items-center justify-center mb-1.5 mx-auto">
                <Car className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-[#0D2558] leading-tight">
                Free Site Visit
              </span>
            </div>
          </div>

          {/* 4. Form / Submission View */}
          {submitted ? (
            <div className="py-6 px-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h4 className="text-xl font-extrabold text-[#0D2558]">
                Registration Successful!
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                Thank you, <strong className="text-[#0D2558] font-bold">{name}</strong>.{' '}
                {successNote ||
                  `Our senior property advisor will call you at ${phone} with the best available offers.`}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-6 py-2.5 bg-[#0D2558] hover:bg-[#163B8C] text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer shadow-sm"
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
                <div
                  role="alert"
                  className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-[#DC1F26] shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Name Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#163B8C]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name *"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl text-sm text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all"
                />
              </div>

              {/* Phone Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#163B8C]">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone *"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl text-sm text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all"
                />
              </div>

              {/* Email Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#163B8C]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (Optional)"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl text-sm text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all"
                />
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#DC1F26] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white font-bold text-xs uppercase tracking-[0.14em] rounded-xl transition-all shadow-md shadow-[#DC1F26]/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                <span>{loading ? 'Submitting...' : 'Send Inquiry'}</span>
              </button>

              {/* Footer reassurance */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <Shield className="w-3.5 h-3.5 text-[#163B8C]" />
                <span>100% Confidential · Direct Support: 977-987-8303</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
