"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "12px",
  padding: "8px 10px",
};

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE as any}>
      {label && <div className="font-medium mb-1">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: p.color || p.payload?.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium tabular-nums">
            {formatCurrency(typeof p.value === "number" ? p.value : 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CategoryDonut({
  data,
  size = 240,
  onSliceClick,
}: {
  data: { name: string; amount: number; color: string }[];
  size?: number;
  onSliceClick?: (entry: any) => void;
}) {
  if (!data.length) return <EmptyChart label="Sem despesas no período" />;
  const total = data.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="relative" style={{ width: "100%", height: size }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            onClick={onSliceClick}
            cursor={onSliceClick ? "pointer" : undefined}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} stroke="var(--color-card)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CurrencyTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
        <span className="font-bold text-lg tabular-nums">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

export function Sparkline({
  data,
  color = "var(--color-destructive)",
  height = 50,
}: {
  data: { day?: string; month?: string; amount: number }[];
  color?: string;
  height?: number;
}) {
  if (!data.length) return null;
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="amount"
            stroke={color}
            strokeWidth={1.75}
            fill="url(#sparkFill)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IncomeExpenseLine({
  data,
  hideIncome,
  height = 280,
}: {
  data: { month: string; income: number; expense: number; label?: string }[];
  hideIncome?: boolean;
  height?: number;
}) {
  if (!data.length) return <EmptyChart label="Sem dados" />;
  const items = data.map((d) => ({
    ...d,
    label: d.label ?? monthShort(d.month),
  }));
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={items} margin={{ top: 10, right: 12, bottom: 6, left: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            tickFormatter={shortNumber}
            width={48}
          />
          <Tooltip content={<CurrencyTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          {!hideIncome && (
            <Line
              type="monotone"
              dataKey="income"
              name="Receitas"
              stroke="var(--color-success)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="expense"
            name="Despesas"
            stroke="var(--color-destructive)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GroupedBars({
  data,
  series,
  height = 280,
  layout = "vertical",
}: {
  data: any[];
  series: { key: string; name: string; color: string }[];
  height?: number;
  layout?: "vertical" | "horizontal";
}) {
  if (!data.length) return <EmptyChart label="Sem dados" />;
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout={layout === "horizontal" ? "vertical" : "horizontal"}
          margin={{ top: 10, right: 16, bottom: 6, left: layout === "horizontal" ? 80 : 0 }}
        >
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={layout === "horizontal"} horizontal={layout !== "horizontal"} />
          {layout === "horizontal" ? (
            <>
              <XAxis type="number" tickFormatter={shortNumber} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" width={80} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" />
              <YAxis tickFormatter={shortNumber} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} stroke="var(--color-border)" width={48} />
            </>
          )}
          <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "color-mix(in srgb, var(--color-muted) 40%, transparent)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
      {label}
    </div>
  );
}

function shortNumber(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

const PT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function monthShort(k: string) {
  const [y, m] = k.split("-").map(Number);
  if (!y || !m) return k;
  return `${PT_MONTHS[m - 1]}/${String(y).slice(-2)}`;
}

export function PercentChange({
  current,
  previous,
  invertColors = false,
}: {
  current: number;
  previous: number;
  invertColors?: boolean;
}) {
  if (!previous || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(pct)) return null;
  const up = pct > 0;
  const goodWhenUp = !invertColors;
  const isGood = up ? goodWhenUp : !goodWhenUp;
  const color = isGood ? "text-success" : "text-destructive";
  const arrow = up ? "▲" : "▼";
  return (
    <span className={`text-[11px] font-medium tabular-nums ${color}`}>
      {arrow} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}
