import { prisma } from "@/lib/prisma";

const STATEMENTS: string[] = [
  `DO $$ BEGIN CREATE TYPE "FinOwner" AS ENUM ('PARTNER_A', 'PARTNER_B', 'COUPLE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "FinAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CASH', 'CREDIT_CARD', 'INVESTMENT', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "FinCategoryKind" AS ENUM ('INCOME', 'EXPENSE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "FinTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "FinRecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "FinInvoiceStatus" AS ENUM ('OPEN', 'CLOSED', 'PAID', 'OVERDUE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

  `CREATE TABLE IF NOT EXISTS "Household" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "partnerAName" TEXT NOT NULL DEFAULT 'Pessoa A',
    "partnerBName" TEXT NOT NULL DEFAULT 'Pessoa B',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "FinAccount" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinAccountType" NOT NULL DEFAULT 'CHECKING',
    "initialBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "creditLimit" DOUBLE PRECISION,
    "closingDay" INTEGER,
    "dueDay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinAccount_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "FinCategory" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FinCategoryKind" NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT,
    "parentId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinCategory_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "FinCreditCardInvoice" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "closingDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentAccountId" TEXT,
    "status" "FinInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinCreditCardInvoice_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "FinRecurringRule" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "owner" "FinOwner" NOT NULL DEFAULT 'COUPLE',
    "accountId" TEXT NOT NULL,
    "toAccountId" TEXT,
    "categoryId" TEXT,
    "frequency" "FinRecurrenceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "dayOfMonth" INTEGER,
    "dayOfWeek" INTEGER,
    "monthOfYear" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "lastGeneratedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinRecurringRule_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "FinTransaction" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "type" "FinTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "owner" "FinOwner" NOT NULL DEFAULT 'COUPLE',
    "paidByOwner" "FinOwner",
    "splitRatio" DOUBLE PRECISION,
    "accountId" TEXT NOT NULL,
    "toAccountId" TEXT,
    "categoryId" TEXT,
    "invoiceId" TEXT,
    "recurringId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinTransaction_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "FinBudget" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "month" TEXT NOT NULL DEFAULT 'default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinBudget_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "FinGoal" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "currentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetDate" TIMESTAMP(3),
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinGoal_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "FinGoalContribution" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinGoalContribution_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "FinSettlement" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fromOwner" "FinOwner" NOT NULL,
    "toOwner" "FinOwner" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinSettlement_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "Household_email_key" ON "Household"("email");`,
  `CREATE INDEX IF NOT EXISTS "FinAccount_householdId_idx" ON "FinAccount"("householdId");`,
  `CREATE INDEX IF NOT EXISTS "FinCategory_householdId_kind_idx" ON "FinCategory"("householdId", "kind");`,
  `CREATE INDEX IF NOT EXISTS "FinTransaction_householdId_date_idx" ON "FinTransaction"("householdId", "date");`,
  `CREATE INDEX IF NOT EXISTS "FinTransaction_accountId_idx" ON "FinTransaction"("accountId");`,
  `CREATE INDEX IF NOT EXISTS "FinTransaction_categoryId_idx" ON "FinTransaction"("categoryId");`,
  `CREATE INDEX IF NOT EXISTS "FinTransaction_invoiceId_idx" ON "FinTransaction"("invoiceId");`,
  `CREATE INDEX IF NOT EXISTS "FinRecurringRule_householdId_active_idx" ON "FinRecurringRule"("householdId", "active");`,
  `CREATE INDEX IF NOT EXISTS "FinBudget_householdId_idx" ON "FinBudget"("householdId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FinBudget_categoryId_month_key" ON "FinBudget"("categoryId", "month");`,
  `CREATE INDEX IF NOT EXISTS "FinCreditCardInvoice_householdId_year_month_idx" ON "FinCreditCardInvoice"("householdId", "year", "month");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FinCreditCardInvoice_accountId_year_month_key" ON "FinCreditCardInvoice"("accountId", "year", "month");`,
  `CREATE INDEX IF NOT EXISTS "FinGoal_householdId_idx" ON "FinGoal"("householdId");`,
  `CREATE INDEX IF NOT EXISTS "FinGoalContribution_goalId_idx" ON "FinGoalContribution"("goalId");`,
  `CREATE INDEX IF NOT EXISTS "FinSettlement_householdId_date_idx" ON "FinSettlement"("householdId", "date");`,

  `DO $$ BEGIN ALTER TABLE "FinAccount" ADD CONSTRAINT "FinAccount_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinCategory" ADD CONSTRAINT "FinCategory_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinCategory" ADD CONSTRAINT "FinCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FinCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinTransaction" ADD CONSTRAINT "FinTransaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinTransaction" ADD CONSTRAINT "FinTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinTransaction" ADD CONSTRAINT "FinTransaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "FinAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinTransaction" ADD CONSTRAINT "FinTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinTransaction" ADD CONSTRAINT "FinTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinCreditCardInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinTransaction" ADD CONSTRAINT "FinTransaction_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "FinRecurringRule"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinRecurringRule" ADD CONSTRAINT "FinRecurringRule_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinRecurringRule" ADD CONSTRAINT "FinRecurringRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinRecurringRule" ADD CONSTRAINT "FinRecurringRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinBudget" ADD CONSTRAINT "FinBudget_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinBudget" ADD CONSTRAINT "FinBudget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinCreditCardInvoice" ADD CONSTRAINT "FinCreditCardInvoice_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinCreditCardInvoice" ADD CONSTRAINT "FinCreditCardInvoice_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinCreditCardInvoice" ADD CONSTRAINT "FinCreditCardInvoice_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "FinAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinGoal" ADD CONSTRAINT "FinGoal_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinGoalContribution" ADD CONSTRAINT "FinGoalContribution_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "FinGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN ALTER TABLE "FinSettlement" ADD CONSTRAINT "FinSettlement_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

  `ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "hideBalances" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "FinTransaction" ADD COLUMN IF NOT EXISTS "paid" BOOLEAN NOT NULL DEFAULT true;`,
  `ALTER TABLE "FinTransaction" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);`,
  `ALTER TABLE "FinAccount" ADD COLUMN IF NOT EXISTS "owner" "FinOwner" NOT NULL DEFAULT 'COUPLE';`,
  `ALTER TABLE "FinTransaction" ADD COLUMN IF NOT EXISTS "installmentGroupId" TEXT;`,
  `ALTER TABLE "FinTransaction" ADD COLUMN IF NOT EXISTS "installmentIndex" INTEGER;`,
  `ALTER TABLE "FinTransaction" ADD COLUMN IF NOT EXISTS "installmentTotal" INTEGER;`,
  `ALTER TABLE "FinTransaction" ADD COLUMN IF NOT EXISTS "installmentProjected" BOOLEAN NOT NULL DEFAULT false;`,
  `CREATE INDEX IF NOT EXISTS "FinTransaction_installmentGroupId_idx" ON "FinTransaction"("installmentGroupId");`,
];

let migrationPromise: Promise<void> | null = null;

export async function ensureFinanceSchema(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigration().catch((err) => {
      migrationPromise = null;
      throw err;
    });
  }
  return migrationPromise;
}

async function runMigration(): Promise<void> {
  for (const stmt of STATEMENTS) {
    await prisma.$executeRawUnsafe(stmt);
  }
}
