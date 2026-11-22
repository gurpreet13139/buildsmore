import React, { useState, useRef } from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { storage } from '../../services/storage';
import { submitPublicInquiry, validateInquiryFields } from '../../utils/inquiryValidation';

interface HeroInquiryFormProps {
  className?: string;
  onInquirySubmitted?: (inquiryId: string) => void;
}

export const HeroInquiryForm: React.FC<HeroInquiryFormProps> = ({
  className = '',
  onInquirySubmitted,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [interestedIn, setInterestedIn] = useState('Residential');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [budgetRange, setBudgetRange] = useState('Flexible / Consultation');
  const [honeypot, setHoneypot] = useState('');
  const formStartedAt = useRef<number>(Date.now());

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const managedLocations = storage.getLocations(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;
    setError(null);

    const validationError = validateInquiryFields({
      fullName,
      phone,
      email: '',
      emailRequired: false,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedLocation = preferredLocation.trim();

    setLoading(true);

    try {
      const summaryMessage = `[Homepage Hero Banner] Interested In: ${interestedIn} | Preferred Location: ${trimmedLocation || 'Not specified'} | Budget: ${budgetRange}`;
      const data = await submitPublicInquiry({
        fullName: trimmedName,
        phone: trimmedPhone,
        propertyType: interestedIn,
        budgetRange,
        preferredLocation: trimmedLocation || undefined,
        preferredContactMethod: 'phone',
        sourceForm: 'hero',
        message: summaryMessage,
        website: honeypot,
        _formStartedAt: formStartedAt.current,
      });

      storage.createInquiry({
        clientName: trimmedName,
        phone: trimmedPhone,
        email: 'Not provided',
        preferredContactMethod: 'phone',
        investmentBudget: budgetRange,
        propertyTitle: `Hero Enquiry (${interestedIn})`,
        message: summaryMessage,
      });

      setSuccessNote(data.message || null);
      setSubmitted(true);
      if (onInquirySubmitted && data.inquiryId) {
        onInquirySubmitted(data.inquiryId);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to submit enquiry right now. Please try again or call +91 977-987-8303.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setFullName('');
    setPhone('');
    setInterestedIn('Residential');
    setPreferredLocation('');
    setBudgetRange('Flexible / Consultation');
    setHoneypot('');
    setSuccessNote(null);
    setError(null);
    formStartedAt.current = Date.now();
  };

  return (
    <div
      className={`bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-5 shadow-2xl shadow-[#0D2558]/15 text-[#0D2558] ${className}`}
    >
      {submitted ? (
        <div className="py-6 px-3 text-center space-y-3 animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <h3 className="text-xl font-extrabold text-[#0D2558]">Enquiry Registered</h3>

          <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
            Thank you, <strong className="text-[#0D2558] font-bold">{fullName}</strong>.{' '}
            {successNote ||
              `Your property enquiry has been submitted to our advisory team. We will contact you at ${phone} shortly.`}
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-2 bg-[#0D2558] hover:bg-[#163B8C] text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer"
            >
              Submit Another Enquiry
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          {/* Off-screen honeypot field for automated bot filtering */}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor="hero-website-field">Website</label>
            <input
              id="hero-website-field"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {/* Card Header */}
          <div className="border-b border-slate-100 pb-2.5">
            <div className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.16em] text-[#DC1F26] uppercase font-extrabold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#DC1F26] shrink-0" />
              <span>Quick Property Enquiry</span>
            </div>
            <h3 className="text-lg font-extrabold text-[#0D2558] mt-0.5 leading-snug">
              Speak With an Advisor
            </h3>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-[#DC1F26] shrink-0 mt-0.5" />
              <span className="leading-tight font-medium">{error}</span>
            </div>
          )}

          {/* 1. Full Name */}
          <div>
            <label
              htmlFor="hero-enquiry-name"
              className="text-[11px] font-bold text-slate-600 block mb-1"
            >
              Full Name <span className="text-[#DC1F26]">*</span>
            </label>
            <input
              id="hero-enquiry-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              disabled={loading}
              className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl px-3 py-2 text-xs text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all disabled:opacity-50"
            />
          </div>

          {/* 2. Mobile Number */}
          <div>
            <label
              htmlFor="hero-enquiry-mobile"
              className="text-[11px] font-bold text-slate-600 block mb-1"
            >
              Mobile Number <span className="text-[#DC1F26]">*</span>
            </label>
            <input
              id="hero-enquiry-mobile"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 977-987-8303"
              disabled={loading}
              className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl px-3 py-2 text-xs text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all tabular-nums disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 3. Interested In (Residential / Commercial / Plots) */}
            <div>
              <label
                htmlFor="hero-enquiry-interest"
                className="text-[11px] font-bold text-slate-600 block mb-1"
              >
                Interested In
              </label>
              <select
                id="hero-enquiry-interest"
                value={interestedIn}
                onChange={(e) => setInterestedIn(e.target.value)}
                disabled={loading}
                className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl px-2.5 py-2 text-xs text-[#0D2558] font-semibold focus:outline-none transition-all cursor-pointer disabled:opacity-50"
              >
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Plots">Plots</option>
              </select>
            </div>

            {/* 4. Budget Range */}
            <div>
              <label
                htmlFor="hero-enquiry-budget"
                className="text-[11px] font-bold text-slate-600 block mb-1"
              >
                Budget Range
              </label>
              <select
                id="hero-enquiry-budget"
                value={budgetRange}
                onChange={(e) => setBudgetRange(e.target.value)}
                disabled={loading}
                className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl px-2.5 py-2 text-xs text-[#0D2558] font-semibold focus:outline-none transition-all cursor-pointer disabled:opacity-50"
              >
                <option value="Flexible / Consultation">Any Budget</option>
                <option value="Under ₹1 Cr">Under ₹1 Cr</option>
                <option value="₹1 Cr – ₹5 Cr">₹1 Cr – ₹5 Cr</option>
                <option value="₹5 Cr – ₹20 Cr">₹5 Cr – ₹20 Cr</option>
                <option value="₹20 Cr – ₹50 Cr">₹20 Cr – ₹50 Cr</option>
                <option value="₹50 Cr+">₹50 Cr+</option>
              </select>
            </div>
          </div>

          {/* 5. Preferred Location */}
          <div>
            <label
              htmlFor="hero-enquiry-location"
              className="text-[11px] font-bold text-slate-600 block mb-1"
            >
              Preferred Location
            </label>
            <input
              id="hero-enquiry-location"
              type="text"
              list="hero-location-suggestions"
              value={preferredLocation}
              onChange={(e) => setPreferredLocation(e.target.value)}
              placeholder="e.g. Mohali, Zirakpur, New Chandigarh"
              disabled={loading}
              className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl px-3 py-2 text-xs text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all disabled:opacity-50"
            />
            {managedLocations.length > 0 && (
              <datalist id="hero-location-suggestions">
                {managedLocations.map((loc) => (
                  <option key={loc.id} value={loc.name} />
                ))}
              </datalist>
            )}
          </div>

          {/* 6. Submit Enquiry Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#DC1F26] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white font-bold text-xs uppercase tracking-[0.12em] rounded-xl transition-all shadow-md shadow-[#DC1F26]/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Submitting Enquiry...' : 'Submit Enquiry'}</span>
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="text-[10px] text-slate-500 text-center font-medium">
            100% Confidential · Direct Line:{' '}
            <span className="text-[#0D2558] font-bold">977-987-8303</span>
          </div>
        </form>
      )}
    </div>
  );
};
