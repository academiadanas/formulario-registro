'use client';

import { InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react';

// =============================================
// Input de texto
// =============================================
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  nota?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, nota, required, className = '', ...props }, ref) => {
    return (
      <div className="mb-5">
        <label className="block mb-2 font-medium text-gray-800 text-[0.95rem]">
          {label}
          {required && <span className="text-primary ml-1 font-bold">*</span>}
        </label>
        {nota && (
          <span className="block text-sm text-gray-500 italic mb-2">{nota}</span>
        )}
        <input
          ref={ref}
          required={required}
          className={`w-full px-4 py-3.5 border-2 rounded-xl text-base text-gray-800 bg-white
            transition-all duration-300
            border-gray-200 hover:border-primary-light
            focus:outline-none focus:border-primary focus:shadow-[0_0_0_4px_rgba(231,74,130,0.08)]
            ${error ? 'border-red-500 bg-red-50' : ''}
            ${className}`}
          {...props}
        />
        {error && (
          <span className="text-red-500 text-sm mt-1 block">{error}</span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

// =============================================
// Select
// =============================================
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, required, className = '', ...props }, ref) => {
    return (
      <div className="mb-5">
        <label className="block mb-2 font-medium text-gray-800 text-[0.95rem]">
          {label}
          {required && <span className="text-primary ml-1 font-bold">*</span>}
        </label>
        <select
          ref={ref}
          required={required}
          className={`w-full px-4 py-3.5 border-2 rounded-xl text-base text-gray-800 bg-white
            cursor-pointer appearance-none
            bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23e74a82' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")]
            bg-no-repeat bg-[right_15px_center] bg-[length:18px] pr-11
            transition-all duration-300
            border-gray-200 hover:border-primary-light
            focus:outline-none focus:border-primary focus:shadow-[0_0_0_4px_rgba(231,74,130,0.08)]
            ${error ? 'border-red-500 bg-red-50' : ''}
            ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="text-red-500 text-sm mt-1 block">{error}</span>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';

// =============================================
// Select agrupado (optgroup)
// =============================================
interface GroupedSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  groups: Record<string, { value: string; label: string }[]>;
  placeholder?: string;
}

export const GroupedSelect = forwardRef<HTMLSelectElement, GroupedSelectProps>(
  ({ label, error, groups, placeholder, required, className = '', ...props }, ref) => {
    return (
      <div className="mb-5">
        <label className="block mb-2 font-medium text-gray-800 text-[0.95rem]">
          {label}
          {required && <span className="text-primary ml-1 font-bold">*</span>}
        </label>
        <select
          ref={ref}
          required={required}
          className={`w-full px-4 py-3.5 border-2 rounded-xl text-base text-gray-800 bg-white
            cursor-pointer appearance-none
            bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23e74a82' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")]
            bg-no-repeat bg-[right_15px_center] bg-[length:18px] pr-11
            transition-all duration-300
            border-gray-200 hover:border-primary-light
            focus:outline-none focus:border-primary focus:shadow-[0_0_0_4px_rgba(231,74,130,0.08)]
            ${error ? 'border-red-500 bg-red-50' : ''}
            ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {Object.entries(groups).map(([groupLabel, opts]) => (
            <optgroup key={groupLabel} label={groupLabel}>
              {opts.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {error && (
          <span className="text-red-500 text-sm mt-1 block">{error}</span>
        )}
      </div>
    );
  }
);
GroupedSelect.displayName = 'GroupedSelect';

// =============================================
// Radio group
// =============================================
interface RadioOption {
  value: string;
  label: string;
  hasOtherInput?: boolean;
}

interface RadioGroupProps {
  label: string;
  name: string;
  options: RadioOption[];
  value: string;
  otherValue?: string;
  onChange: (value: string) => void;
  onOtherChange?: (value: string) => void;
  error?: string;
  required?: boolean;
}

export function RadioGroup({
  label,
  name,
  options,
  value,
  otherValue = '',
  onChange,
  onOtherChange,
  error,
  required,
}: RadioGroupProps) {
  return (
    <div className="mb-5">
      <label className="block mb-2 font-medium text-gray-800 text-[0.95rem]">
        {label}
        {required && <span className="text-primary ml-1 font-bold">*</span>}
      </label>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex items-center gap-3 p-3 px-4 rounded-xl cursor-pointer transition-all duration-300 border-2
              ${
                value === option.value
                  ? 'bg-primary-50 border-primary'
                  : 'bg-gray-50 border-transparent hover:bg-primary-50 hover:border-primary-light'
              }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="w-5 h-5 accent-primary flex-shrink-0"
              required={required}
            />
            <span className="flex-grow">{option.label}</span>
            {option.hasOtherInput && value === option.value && (
              <input
                type="text"
                value={otherValue}
                onChange={(e) => onOtherChange?.(e.target.value)}
                placeholder="Especificar"
                className="w-36 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm
                  focus:outline-none focus:border-primary ml-auto"
              />
            )}
          </label>
        ))}
      </div>
      {error && (
        <span className="text-red-500 text-sm mt-1 block">{error}</span>
      )}
    </div>
  );
}

// =============================================
// File input
// =============================================
interface FileInputProps {
  label: string;
  name: string;
  nota?: string;
  error?: string;
  required?: boolean;
  onChange: (file: File | null) => void;
  fileName?: string;
}

export function FileInput({
  label,
  name,
  nota,
  error,
  required,
  onChange,
  fileName,
}: FileInputProps) {
  return (
    <div className="mb-5">
      <label className="block mb-2 font-medium text-gray-800 text-[0.95rem]">
        {label}
        {required && <span className="text-primary ml-1 font-bold">*</span>}
      </label>
      {nota && (
        <span className="block text-sm text-gray-500 italic mb-2">{nota}</span>
      )}
      <input
        type="file"
        name={name}
        accept=".pdf,.jpg,.jpeg,.png"
        required={required}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        className={`w-full p-3.5 border-2 border-dashed rounded-xl bg-gray-50 cursor-pointer
          transition-all duration-300 font-sans
          hover:border-primary hover:bg-primary-50
          focus:outline-none focus:border-primary focus:border-solid
          ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
      />
      {fileName && (
        <span className="text-sm text-green-600 mt-1 block">
          ✓ {fileName}
        </span>
      )}
      <span className="flex items-center gap-1 text-xs text-gray-500 mt-2 font-medium">
        📌 Tamaño máximo: 5 MB
      </span>
      {error && (
        <span className="text-red-500 text-sm mt-1 block">{error}</span>
      )}
    </div>
  );
}
