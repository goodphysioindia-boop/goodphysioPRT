import React from 'react';
import { ChevronDown } from 'lucide-react';

export function TextField({ label, required, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className={`field-label ${required ? 'field-required' : ''}`}>{label}</label>}
      <input className="input" {...props} />
    </div>
  );
}

export function SelectField({ label, required, options = [], placeholder = 'Choose something', className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className={`field-label ${required ? 'field-required' : ''}`}>{label}</label>}
      <div className="relative">
        <select className="input appearance-none pr-9" {...props}>
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
              {typeof opt === 'string' ? opt : opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      </div>
    </div>
  );
}

export function TextareaField({ label, required, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className={`field-label ${required ? 'field-required' : ''}`}>{label}</label>}
      <textarea className="input min-h-[90px] resize-none" {...props} />
    </div>
  );
}

export function RadioGroup({ label, required, options, value, onChange, className = '' }) {
  return (
    <div className={className}>
      {label && <label className={`field-label ${required ? 'field-required' : ''}`}>{label}</label>}
      <div className="flex flex-wrap gap-4">
        {options.map((opt) => (
          <label key={opt} className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              className="h-4 w-4 accent-brand-600"
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

export function CheckboxGroup({ label, required, options, values = [], onChange, className = '' }) {
  const toggle = (opt) => {
    if (values.includes(opt)) onChange(values.filter((v) => v !== opt));
    else onChange([...values, opt]);
  };
  return (
    <div className={className}>
      {label && <label className={`field-label ${required ? 'field-required' : ''}`}>{label}</label>}
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => (
          <label
            key={opt}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm cursor-pointer transition ${
              values.includes(opt) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'
            }`}
          >
            <input type="checkbox" className="h-3.5 w-3.5 accent-brand-600" checked={values.includes(opt)} onChange={() => toggle(opt)} />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

// The switch itself. The knob is a normal flex child (not absolutely positioned),
// so it always starts at the left edge of the track and slides exactly to the right edge.
export function Switch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
        checked ? 'bg-brand-600' : 'bg-slate-300'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function ToggleField({ label, checked, onChange, disabled = false }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}