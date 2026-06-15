"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, Tags } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/financas/page-header";
import { toast } from "@/components/financas/toaster";
import { confirmDialog } from "@/components/ui/confirm-dialog";

type Category = {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  color: string;
  archived: boolean;
};

const COLORS = [
  "#22c55e", "#10b981", "#06b6d4", "#0ea5e9", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
];

export function CategoriasClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState<"INCOME" | "EXPENSE" | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: "Excluir esta categoria?",
      description: "Se houver lançamentos usando ela, vai ser arquivada em vez de excluída.",
      variant: "destructive",
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleArchive(c: Category) {
    await fetch(`/api/categories/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !c.archived }),
    });
    load();
  }

  async function seedDefaults() {
    const res = await fetch("/api/categories/seed-defaults", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (data.created === 0) {
        toast.info("Você já tem todas as categorias padrão.");
      } else {
        toast.success(`${data.created} categorias criadas`, {
          description: (data.names || []).join(", "),
        });
      }
      load();
    }
  }

  const incomes = categories.filter((c) => c.kind === "INCOME" && !c.archived);
  const expenses = categories.filter((c) => c.kind === "EXPENSE" && !c.archived);
  const archived = categories.filter((c) => c.archived);

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <PageHeader
          title="Categorias"
          description="Organize seus lançamentos para entender para onde o dinheiro vai."
        />
        <button
          onClick={seedDefaults}
          className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground"
          title="Cria as categorias padrão que ainda não existem (não duplica as suas)"
        >
          Sincronizar categorias padrão
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategorySection
            title="Receitas"
            kind="INCOME"
            categories={incomes}
            onAdd={() => setCreating("INCOME")}
            onEdit={setEditing}
            onArchive={toggleArchive}
            onDelete={remove}
          />
          <CategorySection
            title="Despesas"
            kind="EXPENSE"
            categories={expenses}
            onAdd={() => setCreating("EXPENSE")}
            onEdit={setEditing}
            onArchive={toggleArchive}
            onDelete={remove}
          />
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            Arquivadas
          </h2>
          <div className="flex flex-wrap gap-2">
            {archived.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                onEdit={() => setEditing(c)}
                onArchive={() => toggleArchive(c)}
                onDelete={() => remove(c.id)}
              />
            ))}
          </div>
        </div>
      )}

      {creating && (
        <CategoryModal
          kind={creating}
          onClose={() => setCreating(null)}
          onSaved={() => {
            setCreating(null);
            load();
          }}
        />
      )}
      {editing && (
        <CategoryModal
          category={editing}
          kind={editing.kind}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CategorySection({
  title,
  kind,
  categories,
  onAdd,
  onEdit,
  onArchive,
  onDelete,
}: {
  title: string;
  kind: "INCOME" | "EXPENSE";
  categories: Category[];
  onAdd: () => void;
  onEdit: (c: Category) => void;
  onArchive: (c: Category) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Tags className="w-4 h-4 text-muted-foreground" />
          {title}
        </h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </button>
      </div>
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nenhuma categoria de {kind === "INCOME" ? "receita" : "despesa"}.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              onEdit={() => onEdit(c)}
              onArchive={() => onArchive(c)}
              onDelete={() => onDelete(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
  onArchive,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background">
      <span
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: category.color }}
      />
      <span className="text-sm">{category.name}</span>
      <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition">
        <button
          onClick={onEdit}
          className="p-1 rounded text-muted-foreground hover:text-foreground"
          title="Editar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onArchive}
          className="p-1 rounded text-muted-foreground hover:text-foreground"
          title={category.archived ? "Desarquivar" : "Arquivar"}
        >
          {category.archived ? (
            <ArchiveRestore className="w-3.5 h-3.5" />
          ) : (
            <Archive className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded text-muted-foreground hover:text-destructive"
          title="Excluir"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function CategoryModal({
  category,
  kind,
  onClose,
  onSaved,
}: {
  category?: Category;
  kind: "INCOME" | "EXPENSE";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name || "");
  const [color, setColor] = useState(category?.color || COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const url = category
      ? `/api/categories/${category.id}`
      : "/api/categories";
    const res = await fetch(url, {
      method: category ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind, color }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Erro ao salvar");
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <Modal
      title={
        category
          ? "Editar categoria"
          : `Nova categoria de ${kind === "INCOME" ? "receita" : "despesa"}`
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Mercado"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cor</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 ${
                  color === c ? "border-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
