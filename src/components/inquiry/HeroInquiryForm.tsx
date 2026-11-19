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
  const [email, setEmail] = useState('');
  const [propertyType, setPropertyType] = useState('Any Asset Class');
  const [budgetRange, setBudgetRange] = useState('Flexible / Consultation');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const formStartedAt = useRef<number>(Date.now());

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;
    setError(null);

    const validationError = validateInquiryFields({
      fullName,
      phone,
      email,
      emailRequired: false,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    setLoading(true);

    try {
      const summaryMessage = `[Homepage Hero Banner] Property Type: ${propertyType} | Preferred Location: ${preferredLocation.trim() || 'Not specified'} | Budget: ${budgetRange}`;
      const data = await submitPublicInquiry({
        fullName: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail || undefined,
        propertyType,
        budgetRange,
        preferredLocation: preferredLocation.trim() || undefined,
        preferredContactMethod: 'phone',
        sourceForm: 'hero',
        message: summaryMessage,
        website: honeypot,
        _formStartedAt: formStartedAt.current,
      });

      storage.createInquiry({
        clientName: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail || 'Not provided',
        preferredContactMethod: 'phone',
        investmentBudget: budgetRange,
        propertyTitle: `Hero Inquiry (${propertyType})`,
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
          : 'Unable to submit inquiry right now. Please try again or call +91 977-987-8303.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setFullName('');
    setPhone('');
    setEmail('');
    setPropertyType('Any Asset Class');
    setBudgetRange('Flexible / Consultation');
    setPreferredLocation('');
    setHoneypot('');
    setSuccessNote(null);
    setError(null);
    formStartedAt.current = Date.now();
  };

  return (
    <div
      className={`bg-[#12161d]/95 backdrop-blur-xl border border-[#c5a059]/30 rounded-xl p-4 sm:p-5 shadow-2xl text-[#f7f5f2] ${className}`}
    >
      {submitted ? (
        <div className="py-6 px-3 text-center space-y-3 animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-[#c5a059]/15 border border-[#c5a059]/40 flex items-center justify-center mx-auto text-[#c5a059]">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <h3 className="font-serif text-xl sm:text-2xl font-normal text-[#f7f5f2] tracking-wide">
            Inquiry Registered
          </h3>

          <p className="text-xs text-[#cbd5e1] leading-relaxed max-w-xs mx-auto">
            Thank you, <strong className="text-[#f7f5f2] font-semibold">{fullName}</strong>.{' '}
            {successNote ||
              `Your property consultation request has been submitted to our senior advisory team. We will contact you at ${phone} shortly.`}
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-2 bg-[#181f2a] hover:bg-[#202836] border border-[#2a3442] hover:border-[#c5a059] text-xs font-mono uppercase tracking-wider text-[#c5a059] rounded-sm transition-colors cursor-pointer"
            >
              Submit Another Inquiry
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
          <div className="border-b border-[#252f3e] pb-2.5">
            <div className="inline-flex items-center gap-1.5 text-[9px] font-mono tracking-[0.2em] text-[#c5a059] uppercase font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
              <span>Priority Consultation</span>
            </div>
            <h3 className="font-serif text-lg sm:text-xl font-normal text-[#f7f5f2] tracking-wide mt-0.5">
              Property Inquiry
            </h3>
            <p className="text-[11px] text-[#8a909a] mt-0.5 leading-snug">
              Connect with our advisory desk for private allocations.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div role="alert" className="p-2.5 bg-red-950/70 border border-red-500/50 rounded-sm text-red-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          {/* 1. Full Name (Required) */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#8a909a] block mb-1">
              Full Name <span className="text-[#c5a059]">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Vikramjit Singh"
              disabled={loading}
              className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] rounded-sm px-3 py-1.5 text-xs text-[#f7f5f2] placeholder-[#64748b] focus:outline-none transition-all disabled:opacity-50"
            />
          </div>

          {/* 2. Phone Number (Required) */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#8a909a] block mb-1">
              Phone Number <span className="text-[#c5a059]">*</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 977-987-8303"
              disabled={loading}
              className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] rounded-sm px-3 py-1.5 text-xs text-[#f7f5f2] placeholder-[#64748b] focus:outline-none transition-all disabled:opacity-50"
            />
          </div>

          {/* 3. Email Address (Optional) */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#8a909a] block mb-1">
              Email Address <span className="text-[#64748b] lowercase text-[9px]">(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@familyoffice.com"
              disabled={loading}
              className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] rounded-sm px-3 py-1.5 text-xs text-[#f7f5f2] placeholder-[#64748b] focus:outline-none transition-all disabled:opacity-50"
            />
          </div>

          {/* 4. Property Type Dropdown */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#8a909a] block mb-1">
              Property Type
            </label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              disabled={loading}
              className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] rounded-sm px-2.5 py-1.5 text-xs text-[#f7f5f2] focus:outline-none transition-all cursor-pointer disabled:opacity-50"
            >
              <option value="Any Asset Class">Any Asset Class</option>
              <option value="Residential Villa / Estate">Residential Villa / Estate</option>
              <option value="Sky Penthouse / Duplex">Sky Penthouse / Duplex</option>
              <option value="Commercial Landmark">Commercial Landmark</option>
              <option value="Plots & Land Holdings">Plots & Land Holdings</option>
              <option value="New Development Project">New Development Project</option>
            </select>
          </div>

          {/* 5. Budget Range Dropdown */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#8a909a] block mb-1">
              Budget Range
            </label>
            <select
              value={budgetRange}
              onChange={(e) => setBudgetRange(e.target.value)}
              disabled={loading}
              className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] rounded-sm px-2.5 py-1.5 text-xs text-[#f7f5f2] focus:outline-none transition-all cursor-pointer disabled:opacity-50"
            >
              <option value="Flexible / Consultation">Flexible / Consultation</option>
              <option value="Under ₹1 Cr">Under ₹1 Cr</option>
              <option value="₹1 Cr – ₹5 Cr">₹1 Cr – ₹5 Cr</option>
              <option value="₹5 Cr – ₹20 Cr">₹5 Cr – ₹20 Cr</option>
              <option value="₹20 Cr – ₹50 Cr">₹20 Cr – ₹50 Cr</option>
              <option value="₹50 Cr+">₹50 Cr+ (Trophy Asset)</option>
            </select>
          </div>

          {/* 6. Preferred Location (Optional) */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#8a909a] block mb-1">
              Preferred Location <span className="text-[#64748b] lowercase text-[9px]">(optional)</span>
            </label>
            <input
              type="text"
              value={preferredLocation}
              onChange={(e) => setPreferredLocation(e.target.value)}
              placeholder="e.g. IT City Mohali, Sector 82 A"
              disabled={loading}
              className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] rounded-sm px-3 py-1.5 text-xs text-[#f7f5f2] placeholder-[#64748b] focus:outline-none transition-all disabled:opacity-50"
            />
          </div>

          {/* 7. Submit Inquiry Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#c5a059] hover:bg-[#d4af5f] active:bg-[#b38e47] text-[#0c0f12] font-semibold text-xs uppercase tracking-[0.15em] rounded-sm transition-all shadow-md hover:shadow-[#c5a059]/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Submitting Inquiry...' : 'Submit Inquiry'}</span>
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Reassurance text */}
          <div className="text-[10px] text-[#6b7280] text-center pt-0.5 font-mono">
            100% Confidential · Direct Line: 977-987-8303
          </div>
        </form>
      )}
    </div>
  );
};
