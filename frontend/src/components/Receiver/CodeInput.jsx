import React, { useRef, useState, useEffect } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export function CodeInput({ onLookup, isLoading, initialCode = '' }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (initialCode && initialCode.length === 6) {
      const chars = initialCode.split('').slice(0, 6);
      setDigits(chars);
      onLookup(initialCode);
    }
  }, [initialCode]);

  const handleChange = (index, value) => {
    const cleanVal = value.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleanVal;
    setDigits(newDigits);

    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('')) {
      onLookup(fullCode);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    let codeMatch = pastedData.match(/code=(\d{6})/i);
    let extracted = codeMatch ? codeMatch[1] : pastedData.replace(/\D/g, '').slice(0, 6);

    if (extracted.length === 6) {
      const chars = extracted.split('');
      setDigits(chars);
      inputRefs.current[5]?.focus();
      onLookup(extracted);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const fullCode = digits.join('');
    if (fullCode.length === 6) {
      onLookup(fullCode);
    }
  };

  const isComplete = digits.join('').length === 6;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-center">
      <div>
        <div className="flex items-center justify-center gap-2 sm:gap-2.5 my-3" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={isLoading}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              aria-label={`Digit ${index + 1} of 6`}
              className="w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold font-mono bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-50"
            />
          ))}
        </div>
        <p className="text-xs text-slate-400">
          Enter the 6-digit share code or paste the full link
        </p>
      </div>

      <button
        type="submit"
        disabled={!isComplete || isLoading}
        className={`w-full py-3 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
          isComplete && !isLoading
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Finding Files...</span>
          </>
        ) : (
          <>
            <span>Download Files</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
