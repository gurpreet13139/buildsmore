import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../../services/storage';
import { AdminUser } from '../../types/property';
import { X, Lock, Shield, User, KeyRound, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AdminUser) => void;
  authNotice?: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  authNotice,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setError('');
      setShowPassword(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid administrator email address.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          password: password.trim(),
        }),
      });

      const data = await resp.json().catch(() => null);
      setLoading(false);

      if (!resp.ok || !data?.token || !data?.user) {
        setError(data?.error || 'Authentication rejected. Verify your administrator credentials.');
        return;
      }

      const authenticatedUser: AdminUser = {
        id: String(data.user.adminId || data.user.id || 'admin-01'),
        email: String(data.user.email || 'info@buildsmoremohali.com'),
        name: String(data.user.name || 'Executive Managing Director'),
        role: (data.user.role === 'Editor' ? 'Editor' : 'SuperAdmin') as AdminUser['role'],
        lastLoginAt: new Date().toISOString(),
      };

      storage.setAuthenticatedAdmin(authenticatedUser, data.token);
      onLoginSuccess(authenticatedUser);
      onClose();
    } catch {
      setLoading(false);
      setError('Unable to reach authentication server. Please verify the backend service is running.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D2558]/55 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white border border-slate-200 text-[#0D2558] rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close login dialog"
          className="absolute top-4 right-4 text-slate-400 hover:text-[#0D2558] transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="relative inline-block">
            <img
              src="/assets/aistudio/logo-builds_more_aa2f07ab.jpeg"
              alt="BUILDsmore Logo"
              className="w-16 h-16 rounded-lg object-cover border border-slate-200 mx-auto shadow-md"
            />
            <div className="absolute -bottom-1 -right-1 bg-white border border-[#163B8C]/30 p-0.5 rounded-full shadow-xs">
              <Shield className="w-3.5 h-3.5 text-[#163B8C]" />
            </div>
          </div>

          <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[#163B8C] font-semibold block pt-1">
            BUILDsmore · Administrative Gateway
          </span>
          <h2 className="font-serif text-2xl font-semibold text-[#0D2558]">
            Admin Authentication
          </h2>
          <p className="text-xs text-slate-600 max-w-xs mx-auto">
            Sign in with verified administrator credentials to manage properties, inquiries, and settings.
          </p>
        </div>

        {/* Session Notice Feedback */}
        {!error && authNotice && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{authNotice}</span>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-[#DC1F26] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Inputs (Starts Empty for User to Fill) */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[11px] font-mono font-semibold text-slate-600 uppercase block mb-1.5">
              Administrator Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@buildsmoremohali.com"
                className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white rounded-lg pl-9 pr-3 py-2.5 text-xs text-[#0D2558] placeholder-slate-400 focus:outline-none font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-mono font-semibold text-slate-600 uppercase block">
                Password
              </label>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white rounded-lg pl-9 pr-10 py-2.5 text-xs text-[#0D2558] placeholder-slate-400 focus:outline-none font-mono transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0D2558] transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#0D2558] hover:bg-[#DC1F26] text-white text-xs uppercase tracking-widest font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#0D2558]/20 disabled:opacity-50 mt-2"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{loading ? 'Authenticating Session...' : 'Sign In as Administrator'}</span>
          </button>
        </form>

        {/* Secure Session Notice */}
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-start gap-2.5 text-[11px] text-slate-600 leading-relaxed bg-[#F4F7FC] p-3 border border-slate-200 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-[#163B8C] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#0D2558] block">Browser-Bound Secure Session</strong>
              Your session expires immediately whenever you close the browser window or tab.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
