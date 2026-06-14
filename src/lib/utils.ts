import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// For date-only fields (dueDate, startDate). Stored as UTC midnight; format in UTC to keep the calendar day stable.
export function formatDateBR(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

// "Today" in the BR timezone, normalised to UTC midnight (so it can be compared to UTC-stored dueDates).
export function startOfTodayBR(): Date {
  const now = new Date();
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()));
}

export function isInvoiceOverdue(invoice: { status: string; dueDate: Date | string }): boolean {
  if (invoice.status === "PAID" || invoice.status === "CANCELED" || invoice.status === "REFUNDED") return false;
  if (invoice.status === "OVERDUE") return true;
  return new Date(invoice.dueDate) < startOfTodayBR();
}

export function getLeadScoreLabel(score: number): { label: string; color: string } {
  if (score >= 75) return { label: "Muito Quente", color: "#ef4444" };
  if (score >= 50) return { label: "Quente", color: "#f97316" };
  if (score >= 25) return { label: "Morno", color: "#eab308" };
  return { label: "Frio", color: "#3b82f6" };
}

export function getPriorityColor(priority: string): string {
  switch (priority.toLowerCase()) {
    case "urgente":
      return "#ef4444";
    case "alta":
      return "#f97316";
    case "média":
    case "media":
      return "#eab308";
    case "baixa":
      return "#22c55e";
    default:
      return "#6b7280";
  }
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "novo":
      return "#3b82f6";
    case "em contato":
      return "#8b5cf6";
    case "qualificado":
      return "#eab308";
    case "proposta enviada":
      return "#f97316";
    case "negociação":
    case "negociacao":
      return "#ec4899";
    case "fechado ganho":
      return "#22c55e";
    case "fechado perdido":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

export function timeAgo(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) return "há poucos segundos";
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
  if (diffWeeks < 5) return `há ${diffWeeks} semana${diffWeeks > 1 ? "s" : ""}`;
  return `há ${diffMonths} ${diffMonths > 1 ? "meses" : "mês"}`;
}

export function calculateDealProbability(stageName: string): number {
  switch (stageName.toLowerCase()) {
    case "novo lead":
      return 10;
    case "em contato":
      return 20;
    case "qualificado":
      return 40;
    case "proposta enviada":
      return 60;
    case "negociação":
    case "negociacao":
      return 80;
    case "fechado ganho":
      return 100;
    case "fechado perdido":
      return 0;
    default:
      return 0;
  }
}
