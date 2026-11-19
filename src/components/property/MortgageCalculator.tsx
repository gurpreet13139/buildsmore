import React, { useState } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { Calculator } from 'lucide-react';

interface MortgageCalculatorProps {
  propertyPrice: number;
  currency: string;
}

export const MortgageCalculator: React.FC<MortgageCalculatorProps> = ({
  propertyPrice,
}) => {
  const { formatPrice } = useCurrency();
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(30); // 30% standard luxury down payment
  const [interestRate, setInterestRate] = useState<number>(4.8); // 4.8% typical private bank rate
  const [loanTermYears, setLoanTermYears] = useState<number>(25);

  const downPaymentAmount = (propertyPrice * downPaymentPercent) / 100;
  const loanPrincipal = propertyPrice - downPaymentAmount;

  // Monthly mortgage calculation: M = P [ i(1 + i)^n ] / [ (1 + i)^n – 1]
  const monthlyRate = interestRate / 100 / 12;
  const totalMonths = loanTermYears * 12;

  const monthlyPayment = monthlyRate > 0 && totalMonths > 0
    ? (loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
      (Math.pow(1 + monthlyRate, totalMonths) - 1)
    : 0;

  // Estimated stamp duty / acquisition tax (~4-6%)
  const estimatedTransferDuty = propertyPrice * 0.05;

  return (
    <div className="bg-[#12161d] border border-[#222b37] p-6 rounded-sm space-y-6">
      
      <div className="flex items-center justify-between pb-4 border-b border-[#202733]">
        <div className="flex items-center gap-2.5">
          <Calculator className="w-4 h-4 text-[#c5a059]" />
          <h3 className="font-serif text-lg font-medium text-[#f7f5f2]">
            Private Wealth Financing Estimator
          </h3>
        </div>
        <span className="text-[11px] font-mono text-[#8a909a] uppercase tracking-wider">
          Private Bank Terms
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Down Payment % Slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-[#8a909a]">Equity Down Payment</span>
            <span className="text-[#f7f5f2] font-mono font-semibold">{downPaymentPercent}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="70"
            step="5"
            value={downPaymentPercent}
            onChange={(e) => setDownPaymentPercent(parseInt(e.target.value, 10))}
            className="w-full accent-[#c5a059] cursor-pointer"
          />
          <div className="text-[11px] font-mono text-[#737a85] text-right tabular-nums">
            {formatPrice(downPaymentAmount)}
          </div>
        </div>

        {/* Interest Rate */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-[#8a909a]">Interest Rate (Fixed/LTV)</span>
            <span className="text-[#f7f5f2] font-mono font-semibold">{interestRate}%</span>
          </div>
          <input
            type="range"
            min="2.5"
            max="9.0"
            step="0.1"
            value={interestRate}
            onChange={(e) => setInterestRate(parseFloat(e.target.value))}
            className="w-full accent-[#c5a059] cursor-pointer"
          />
          <div className="text-[11px] font-mono text-[#737a85] text-right">
            Lombard & Structured Credit
          </div>
        </div>

        {/* Loan Term */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-[#8a909a]">Repayment Horizon</span>
            <span className="text-[#f7f5f2] font-mono font-semibold">{loanTermYears} Years</span>
          </div>
          <select
            value={loanTermYears}
            onChange={(e) => setLoanTermYears(parseInt(e.target.value, 10))}
            className="w-full bg-[#181f2a] border border-[#283342] text-[#f7f5f2] text-xs rounded-sm px-3 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="15">15 Years (180 Payments)</option>
            <option value="20">20 Years (240 Payments)</option>
            <option value="25">25 Years (300 Payments)</option>
            <option value="30">30 Years (360 Payments)</option>
          </select>
        </div>

      </div>

      {/* Summary Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#202733] bg-[#0e1217] p-4 rounded-sm">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#8a909a] block">
            Estimated Monthly Service
          </span>
          <span className="text-xl font-bold font-serif text-[#c5a059] font-mono tabular-nums">
            {formatPrice(Math.round(monthlyPayment))}
            <span className="text-xs text-[#8a909a] font-sans font-normal ml-1">/mo</span>
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#8a909a] block">
            Loan Principal Amount
          </span>
          <span className="text-sm font-semibold text-[#f7f5f2] font-mono tabular-nums">
            {formatPrice(loanPrincipal)}
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#8a909a] block">
            Est. Transfer & Legal Duty (5%)
          </span>
          <span className="text-sm font-semibold text-[#f7f5f2] font-mono tabular-nums">
            {formatPrice(estimatedTransferDuty)}
          </span>
        </div>
      </div>

    </div>
  );
};
