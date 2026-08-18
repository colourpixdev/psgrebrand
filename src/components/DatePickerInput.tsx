interface DatePickerInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePickerInput({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  className = '',
}: DatePickerInputProps) {
  return (
    <label className="grid gap-2">
      {label && <span className="text-sm text-slate-300">{label}</span>}
      <div className="relative">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 pr-10 text-sm text-white outline-none placeholder:text-slate-300 focus:border-cyan-300/50 disabled:opacity-50 ${className}`}
        />
      </div>
    </label>
  );
}
