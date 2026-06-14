"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type SegOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
};

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 mb-5 flex flex-wrap items-end gap-3">
      {children}
    </div>
  );
}

export function FilterGroup({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export function SegControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegOption<T>[];
}) {
  return (
    <div className="inline-flex items-center bg-muted/50 border border-border rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function MonthStepper({
  monthLabel,
  onPrev,
  onNext,
  onToday,
}: {
  monthLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
}) {
  return (
    <div className="inline-flex items-center bg-muted/50 border border-border rounded-lg overflow-hidden">
      <button
        onClick={onPrev}
        className="px-2 py-1.5 hover:bg-muted text-muted-foreground"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="px-3 py-1.5 text-xs font-medium capitalize min-w-[120px] text-center">
        {monthLabel}
      </span>
      <button
        onClick={onNext}
        className="px-2 py-1.5 hover:bg-muted text-muted-foreground"
        aria-label="Próximo mês"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      {onToday && (
        <button
          onClick={onToday}
          className="px-3 py-1.5 hover:bg-muted text-xs font-medium border-l border-border text-muted-foreground"
        >
          Hoje
        </button>
      )}
    </div>
  );
}

export function DateRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="inline-flex items-center bg-background border border-border rounded-lg overflow-hidden">
      <input
        type="date"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
        className="px-2 py-1.5 text-xs bg-transparent outline-none"
      />
      <span className="text-xs text-muted-foreground px-1">→</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
        className="px-2 py-1.5 text-xs bg-transparent outline-none"
      />
    </div>
  );
}

export function SelectFilter<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  clearable = false,
}: {
  value: T | "";
  onChange: (v: T | "") => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  clearable?: boolean;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none px-3 py-1.5 pr-8 text-xs font-medium bg-muted/50 border border-border rounded-lg hover:bg-muted cursor-pointer min-w-[140px]"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {clearable && value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-1.5 p-0.5 hover:bg-muted-foreground/20 rounded"
          aria-label="Limpar"
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 pr-8 text-xs bg-muted/50 border border-border rounded-lg hover:bg-muted focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted-foreground/20 rounded"
          aria-label="Limpar"
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
