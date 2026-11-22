import React, { useState } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { Calculator } from 'lucide-react';

interface MortgageCalculatorProps {
  propertyPrice: number;
  currency: string;
}

export const MortgageCalculator: React.FC<MortgageCalculatorProps> = ({ propertyPrice }) => {
  const { formatPrice } = useCurrency();
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(30);
  const [interestRate, setInterestRate] = useState<number>(4.8);
  const [loanTermYears, setLoanTermYears] = useState<number>(25);

  const downPaymentAmount = (propertyPrice * downPaymentPercent) / 100;
  const loanPrincipal = propertyPrice - downPaymentAmount;

  const monthlyRate = interestRate / 100 / 12;
  const totalMonths = loanTermYears * 12;

  const monthlyPayment =
    monthlyRate > 0 && totalMonths > 0
      ? (loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1)
      : 0;

  const estimatedTransferDuty = propertyPrice * 0.05;

  return (
    <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-xs space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#EEF3FB] text-[#163B8C] flex items-center justify-center">
            <Calculator className="w-4 h-4" />
          </div>
          <h3 className="text-lg font-extrabold text-[#0D2558]">
            Private Wealth Financing Estimator
          </h3>
        </div>
        <span className="text-[11px] font-bold text-[#163B8C] uppercase tracking-wider">
          Private Bank Terms
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Down Payment % Slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-600 font-medium">Equity Down Payment</span>
            <span className="text-[#0D2558] font-extrabold">{downPaymentPercent}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="70"
            step="5"
            value={downPaymentPercent}
            onChange={(e) => setDownPaymentPercent(parseInt(e.target.value, 10))}
            className="w-full accent-[#DC1F26] cursor-pointer"
          />
          <div className="text-[11px] font-semibold text-slate-500 text-right tabular-nums">
            {formatPrice(downPaymentAmount)}
          </div>
        </div>

        {/* Interest Rate */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-600 font-medium">Interest Rate</span>
            <span className="text-[#0D2558] font-extrabold">{interestRate}%</span>
          </div>
          <input
            type="range"
            min="2.5"
            max="9.0"
            step="0.1"
            value={interestRate}
            onChange={(e) => setInterestRate(parseFloat(e.target.value))}
            className="w-full accent-[#DC1F26] cursor-pointer"
          />
          <div className="text-[11px] font-medium text-slate-500 text-right">
            Lombard &amp; Structured Credit
          </div>
        </div>

        {/* Loan Term */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-600 font-medium">Repayment Horizon</span>
            <span className="text-[#0D2558] font-extrabold">{loanTermYears} Years</span>
          </div>
          <select
            value={loanTermYears}
            onChange={(e) => setLoanTermYears(parseInt(e.target.value, 10))}
            className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] text-[#0D2558] font-semibold text-xs rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="15">15 Years (180 Payments)</option>
            <option value="20">20 Years (240 Payments)</option>
            <option value="25">25 Years (300 Payments)</option>
            <option value="30">30 Years (360 Payments)</option>
          </select>
        </div>
      </div>

      {/* Summary Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#F7F9FC] border border-slate-200/80 p-4 rounded-xl">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
            Estimated Monthly Service
          </span>
          <span className="text-xl font-extrabold text-[#DC1F26] tabular-nums">
            {formatPrice(Math.round(monthlyPayment))}
            <span className="text-xs text-slate-500 font-medium ml-1">/mo</span>
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
            Loan Principal Amount
          </span>
          <span className="text-sm font-extrabold text-[#0D2558] tabular-nums block mt-1">
            {formatPrice(loanPrincipal)}
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
            Est. Transfer &amp; Legal Duty (5%)
          </span>
          <span className="text-sm font-extrabold text-[#0D2558] tabular-nums block mt-1">
            {formatPrice(estimatedTransferDuty)}
          </span>
        </div>
      </div>
    </div>
  );
};
