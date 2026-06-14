/**
 * Migração de dados Arthea → Arthea Finanças
 *
 * Lê tudo de um Household + entidades Fin* do banco antigo (`SOURCE_DATABASE_URL`)
 * e copia para o banco novo (`DATABASE_URL`). Gera IDs novos pra evitar colisão.
 *
 * Uso:
 *   SOURCE_DATABASE_URL="postgresql://...antigo" \
 *   DATABASE_URL="postgresql://...novo" \
 *   SOURCE_EMAIL="seu@email.com" \
 *   npx tsx scripts/migrate-from-arthea.ts
 *
 * Por padrão pega o PRIMEIRO Household do banco antigo. Se houver vários, defina
 * SOURCE_EMAIL para escolher qual migrar.
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.DATABASE_URL;
const SOURCE_EMAIL = process.env.SOURCE_EMAIL?.toLowerCase().trim();

if (!SOURCE_URL) {
  console.error("❌ Defina SOURCE_DATABASE_URL com a connection string do Arthea atual.");
  process.exit(1);
}
if (!TARGET_URL) {
  console.error("❌ Defina DATABASE_URL com a connection string do Arthea Finanças novo.");
  process.exit(1);
}

const source = new PrismaClient({ datasourceUrl: SOURCE_URL });
const target = new PrismaClient({ datasourceUrl: TARGET_URL });

/** Mapas de IDs antigos → IDs novos */
const idMap = {
  household: new Map<string, string>(),
  account: new Map<string, string>(),
  category: new Map<string, string>(),
  invoice: new Map<string, string>(),
  rule: new Map<string, string>(),
  goal: new Map<string, string>(),
  tx: new Map<string, string>(),
};

function newId(): string {
  return "c" + randomUUID().replace(/-/g, "").slice(0, 24);
}

async function main() {
  console.log("🔌 Conectando aos bancos...");

  // === 1) Pega o Household de origem ===
  const sourceHouseholds = await source.household.findMany({
    where: SOURCE_EMAIL ? { email: SOURCE_EMAIL } : undefined,
    orderBy: { createdAt: "asc" },
  });
  if (sourceHouseholds.length === 0) {
    console.error(`❌ Nenhum Household encontrado no banco origem${SOURCE_EMAIL ? ` com email ${SOURCE_EMAIL}` : ""}.`);
    process.exit(1);
  }
  const srcH = sourceHouseholds[0];
  console.log(`✓ Origem: ${srcH.email} (${srcH.partnerAName} + ${srcH.partnerBName})`);

  // === 2) Pergunta o que fazer com o Household destino ===
  const existingTarget = await target.household.findMany();
  let targetHouseholdId: string;
  if (existingTarget.length > 0) {
    console.log(`✓ Destino já tem ${existingTarget.length} Household(s). Vou copiar a entidade existente:`);
    console.log(`  → ${existingTarget[0].email}`);
    targetHouseholdId = existingTarget[0].id;
    // Atualiza nomes pros do origem (preserva email/senha já cadastrados)
    await target.household.update({
      where: { id: targetHouseholdId },
      data: {
        partnerAName: srcH.partnerAName,
        partnerBName: srcH.partnerBName,
        currency: srcH.currency,
        hideBalances: srcH.hideBalances,
      },
    });
    console.log("  ✓ Nomes/moeda atualizados pra bater com a origem.");
  } else {
    console.log("✓ Destino vazio. Criando Household espelho...");
    const newH = await target.household.create({
      data: {
        email: srcH.email,
        password: srcH.password,
        partnerAName: srcH.partnerAName,
        partnerBName: srcH.partnerBName,
        currency: srcH.currency,
        hideBalances: srcH.hideBalances,
      },
    });
    targetHouseholdId = newH.id;
  }
  idMap.household.set(srcH.id, targetHouseholdId);

  // === 3) Contas ===
  const accounts = await source.finAccount.findMany({ where: { householdId: srcH.id } });
  console.log(`\n📋 ${accounts.length} conta(s)...`);
  for (const a of accounts) {
    const id = newId();
    idMap.account.set(a.id, id);
    await target.finAccount.create({
      data: {
        id,
        householdId: targetHouseholdId,
        name: a.name,
        type: a.type,
        initialBalance: a.initialBalance,
        color: a.color,
        icon: a.icon,
        archived: a.archived,
        creditLimit: a.creditLimit,
        closingDay: a.closingDay,
        dueDay: a.dueDay,
        owner: a.owner,
      },
    });
  }
  console.log(`  ✓ ${accounts.length} criadas`);

  // === 4) Categorias (parent depois) ===
  const cats = await source.finCategory.findMany({ where: { householdId: srcH.id } });
  console.log(`\n📋 ${cats.length} categoria(s)...`);
  for (const c of cats) {
    const id = newId();
    idMap.category.set(c.id, id);
    await target.finCategory.create({
      data: {
        id,
        householdId: targetHouseholdId,
        name: c.name,
        kind: c.kind,
        color: c.color,
        icon: c.icon,
        archived: c.archived,
      },
    });
  }
  // Segundo pass pra setar parentId
  for (const c of cats) {
    if (c.parentId && idMap.category.has(c.parentId)) {
      await target.finCategory.update({
        where: { id: idMap.category.get(c.id)! },
        data: { parentId: idMap.category.get(c.parentId)! },
      });
    }
  }
  console.log(`  ✓ ${cats.length} criadas + hierarquia`);

  // === 5) Faturas ===
  const invoices = await source.finCreditCardInvoice.findMany({ where: { householdId: srcH.id } });
  console.log(`\n📋 ${invoices.length} fatura(s)...`);
  for (const inv of invoices) {
    const id = newId();
    idMap.invoice.set(inv.id, id);
    await target.finCreditCardInvoice.create({
      data: {
        id,
        householdId: targetHouseholdId,
        accountId: idMap.account.get(inv.accountId)!,
        year: inv.year,
        month: inv.month,
        closingDate: inv.closingDate,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        paymentAccountId: inv.paymentAccountId ? idMap.account.get(inv.paymentAccountId) ?? null : null,
        status: inv.status,
        notes: inv.notes,
      },
    });
  }
  console.log(`  ✓ ${invoices.length} criadas`);

  // === 6) Regras de recorrência ===
  const rules = await source.finRecurringRule.findMany({ where: { householdId: srcH.id } });
  console.log(`\n📋 ${rules.length} regra(s) de recorrência...`);
  for (const r of rules) {
    const id = newId();
    idMap.rule.set(r.id, id);
    await target.finRecurringRule.create({
      data: {
        id,
        householdId: targetHouseholdId,
        name: r.name,
        type: r.type,
        amount: r.amount,
        description: r.description,
        notes: r.notes,
        owner: r.owner,
        accountId: idMap.account.get(r.accountId)!,
        toAccountId: r.toAccountId ? idMap.account.get(r.toAccountId) ?? null : null,
        categoryId: r.categoryId ? idMap.category.get(r.categoryId) ?? null : null,
        frequency: r.frequency,
        dayOfMonth: r.dayOfMonth,
        dayOfWeek: r.dayOfWeek,
        monthOfYear: r.monthOfYear,
        startDate: r.startDate,
        endDate: r.endDate,
        lastGeneratedAt: r.lastGeneratedAt,
        active: r.active,
      },
    });
  }
  console.log(`  ✓ ${rules.length} criadas`);

  // === 7) Transações (a maior tabela) ===
  const txs = await source.finTransaction.findMany({ where: { householdId: srcH.id } });
  console.log(`\n📋 ${txs.length} transação(ões)...`);
  let count = 0;
  for (const t of txs) {
    const id = newId();
    idMap.tx.set(t.id, id);
    await target.finTransaction.create({
      data: {
        id,
        householdId: targetHouseholdId,
        type: t.type,
        amount: t.amount,
        date: t.date,
        description: t.description,
        notes: t.notes,
        owner: t.owner,
        paidByOwner: t.paidByOwner,
        splitRatio: t.splitRatio,
        paid: t.paid,
        paidAt: t.paidAt,
        accountId: idMap.account.get(t.accountId)!,
        toAccountId: t.toAccountId ? idMap.account.get(t.toAccountId) ?? null : null,
        categoryId: t.categoryId ? idMap.category.get(t.categoryId) ?? null : null,
        invoiceId: t.invoiceId ? idMap.invoice.get(t.invoiceId) ?? null : null,
        recurringId: t.recurringId ? idMap.rule.get(t.recurringId) ?? null : null,
        installmentGroupId: t.installmentGroupId,
        installmentIndex: t.installmentIndex,
        installmentTotal: t.installmentTotal,
        installmentProjected: t.installmentProjected,
      },
    });
    count++;
    if (count % 50 === 0) console.log(`  ... ${count}/${txs.length}`);
  }
  console.log(`  ✓ ${txs.length} criadas`);

  // === 8) Orçamentos ===
  const budgets = await source.finBudget.findMany({ where: { householdId: srcH.id } });
  console.log(`\n📋 ${budgets.length} orçamento(s)...`);
  for (const b of budgets) {
    await target.finBudget.create({
      data: {
        householdId: targetHouseholdId,
        categoryId: idMap.category.get(b.categoryId)!,
        amount: b.amount,
        month: b.month,
      },
    });
  }
  console.log(`  ✓ ${budgets.length} criados`);

  // === 9) Metas + contribuições ===
  const goals = await source.finGoal.findMany({ where: { householdId: srcH.id } });
  console.log(`\n📋 ${goals.length} meta(s)...`);
  for (const g of goals) {
    const id = newId();
    idMap.goal.set(g.id, id);
    await target.finGoal.create({
      data: {
        id,
        householdId: targetHouseholdId,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        targetDate: g.targetDate,
        color: g.color,
        icon: g.icon,
        notes: g.notes,
        archived: g.archived,
      },
    });
  }
  const contribs = await source.finGoalContribution.findMany({
    where: { goal: { householdId: srcH.id } },
  });
  for (const c of contribs) {
    if (!idMap.goal.has(c.goalId)) continue;
    await target.finGoalContribution.create({
      data: {
        goalId: idMap.goal.get(c.goalId)!,
        amount: c.amount,
        date: c.date,
        notes: c.notes,
      },
    });
  }
  console.log(`  ✓ ${goals.length} metas + ${contribs.length} contribuições`);

  // === 10) Acertos do casal ===
  const settlements = await source.finSettlement.findMany({ where: { householdId: srcH.id } });
  console.log(`\n📋 ${settlements.length} acerto(s) do casal...`);
  for (const s of settlements) {
    await target.finSettlement.create({
      data: {
        householdId: targetHouseholdId,
        amount: s.amount,
        fromOwner: s.fromOwner,
        toOwner: s.toOwner,
        date: s.date,
        notes: s.notes,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
      },
    });
  }
  console.log(`  ✓ ${settlements.length} criados`);

  console.log("\n✅ Migração concluída.");
  console.log("    Recarregue o app que vai aparecer tudo.");
}

main()
  .catch((e) => {
    console.error("\n❌ Erro na migração:", e);
    process.exit(1);
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
