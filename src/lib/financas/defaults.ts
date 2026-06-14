import type { FinCategoryKind, FinAccountType } from "@prisma/client";

export const DEFAULT_CATEGORIES: {
  name: string;
  kind: FinCategoryKind;
  color: string;
  icon: string;
}[] = [
  // Receitas
  { name: "Salário", kind: "INCOME", color: "#22c55e", icon: "Briefcase" },
  { name: "Freelance / Extras", kind: "INCOME", color: "#10b981", icon: "Coins" },
  { name: "Investimentos", kind: "INCOME", color: "#06b6d4", icon: "TrendingUp" },
  { name: "Reembolsos", kind: "INCOME", color: "#0ea5e9", icon: "Undo2" },
  { name: "Outras receitas", kind: "INCOME", color: "#84cc16", icon: "Wallet" },
  // Despesas — moradia e contas
  { name: "Moradia", kind: "EXPENSE", color: "#6366f1", icon: "Home" },
  { name: "Contas (luz/água/internet)", kind: "EXPENSE", color: "#8b5cf6", icon: "Plug" },
  { name: "Mercado", kind: "EXPENSE", color: "#f97316", icon: "ShoppingCart" },
  { name: "Restaurantes / Delivery", kind: "EXPENSE", color: "#ef4444", icon: "Utensils" },
  { name: "Transporte", kind: "EXPENSE", color: "#eab308", icon: "Car" },
  { name: "Saúde", kind: "EXPENSE", color: "#ec4899", icon: "Heart" },
  { name: "Educação", kind: "EXPENSE", color: "#14b8a6", icon: "GraduationCap" },
  { name: "Lazer", kind: "EXPENSE", color: "#a855f7", icon: "Smile" },
  { name: "Compras", kind: "EXPENSE", color: "#f59e0b", icon: "ShoppingBag" },
  { name: "Assinaturas", kind: "EXPENSE", color: "#0284c7", icon: "Repeat" },
  { name: "Viagem", kind: "EXPENSE", color: "#0891b2", icon: "Plane" },
  { name: "Cuidados pessoais", kind: "EXPENSE", color: "#db2777", icon: "Sparkles" },
  { name: "Pets", kind: "EXPENSE", color: "#65a30d", icon: "PawPrint" },
  { name: "Presentes", kind: "EXPENSE", color: "#f43f5e", icon: "Gift" },
  { name: "Outras despesas", kind: "EXPENSE", color: "#737373", icon: "MoreHorizontal" },
];

export const DEFAULT_ACCOUNTS: {
  name: string;
  type: FinAccountType;
  initialBalance: number;
  color: string;
}[] = [
  { name: "Conta corrente", type: "CHECKING", initialBalance: 0, color: "#6366f1" },
  { name: "Poupança", type: "SAVINGS", initialBalance: 0, color: "#10b981" },
  { name: "Dinheiro", type: "CASH", initialBalance: 0, color: "#84cc16" },
];

export const ACCOUNT_TYPE_LABEL: Record<FinAccountType, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão de crédito",
  INVESTMENT: "Investimento",
  OTHER: "Outra",
};

export const OWNER_LABEL: Record<"PARTNER_A" | "PARTNER_B" | "COUPLE", string> = {
  PARTNER_A: "Parceiro A",
  PARTNER_B: "Parceiro B",
  COUPLE: "Casal",
};
