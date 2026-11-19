import React, { createContext, useContext, useState, useEffect } from 'react';
import { CurrencyCode } from '../types/property';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  formatPrice: (amount: number, sourceCurrency?: CurrencyCode) => string;
}

// Exchange conversion rates to INR
const RATES_TO_INR: Record<CurrencyCode, number> = {
  INR: 1,
  USD: 86.5,
  EUR: 94.0,
  GBP: 110.5,
  AED: 23.55,
};

const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'INR',
  setCurrency: () => {},
  formatPrice: (amount) => `₹ ${amount ? amount.toLocaleString('en-IN') : 0}`,
});

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>('INR');

  useEffect(() => {
    setCurrencyState('INR');
    localStorage.setItem('buildsmore_currency_pref_v1', 'INR');
  }, []);

  const setCurrency = (c: CurrencyCode) => {
    // Platform standard is strictly INR
    setCurrencyState('INR');
    localStorage.setItem('buildsmore_currency_pref_v1', 'INR');
  };

  const formatPrice = (amount: number, sourceCurrency: CurrencyCode = 'INR'): string => {
    if (!amount || amount === 0) return 'Price on Request';
    
    // Convert to INR if source property was captured in another currency
    const rateToInr = RATES_TO_INR[sourceCurrency] || 1;
    const amountInInr = sourceCurrency === 'INR' ? amount : Math.round(amount * rateToInr);

    return `₹ ${amountInInr.toLocaleString('en-IN')}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);

