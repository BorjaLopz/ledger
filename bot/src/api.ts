export interface Category {
  id: string;
  name: string;
  type: "expense" | "income";
  icon: string;
  color: string;
}

export interface Tx {
  id: string;
  type: "expense" | "income";
  amount: number;
  categoryId: string;
  date: string;
  note: string;
  receiptUrl: string | null;
}

export interface Summary {
  /** "2026-11" o "2026-11-02/2026-11-08" */
  period: string;
  income: number;
  expense: number;
  balance: number;
  expenseByCategory: { category: string; total: number }[];
}

/** Sin valor = mes actual. */
export type SummaryRange = { month: string } | { from: string; to: string } | undefined;

export interface Suggestion {
  categoryId: string;
  count: number;
}

export interface CategoryUsage extends Category {
  transactions: number;
  recurring: number;
}

export interface CategoryInput {
  name?: string;
  type?: "expense" | "income";
  icon?: string;
  color?: string;
}

export interface MonthTotal {
  /** "2026-11" */
  month: string;
  income: number;
  expense: number;
}

/** Que exportar a CSV; sin valor = todo. */
export type ExportScope = { month: string } | { year: string } | undefined;

export interface Warranty {
  id: string;
  name: string;
  purchaseDate: string;
  months: number;
  expiresOn: string;
  /** Dias hasta que caduca; negativo si ya caducó. */
  daysLeft: number;
  note: string;
  receiptUrl: string | null;
}

export interface NewWarranty {
  name: string;
  purchaseDate?: string;
  months: number;
  note?: string;
}

export interface TxEdit {
  amount?: number;
  categoryId?: string;
  date?: string;
  note?: string;
}

export interface NewTx {
  type: "expense" | "income";
  amount: number;
  categoryId: string;
  note: string;
  date?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Cliente de la API /api/bot del Ledger. */
export interface LedgerClient {
  categories(): Promise<Category[]>;
  createTransaction(input: NewTx): Promise<Tx>;
  lastTransaction(): Promise<Tx | null>;
  attachReceipt(id: string, bytes: ArrayBuffer, filename: string, contentType: string): Promise<Tx>;
  deleteTransaction(id: string): Promise<boolean>;
  summary(range?: SummaryRange): Promise<Summary>;
  suggestCategory(note: string, type: "expense" | "income"): Promise<Suggestion | null>;
  searchTransactions(q: string, limit?: number): Promise<Tx[]>;
  editTransaction(id: string, edit: TxEdit): Promise<Tx>;
  warranties(): Promise<Warranty[]>;
  createWarranty(input: NewWarranty): Promise<Warranty>;
  attachWarrantyReceipt(id: string, bytes: ArrayBuffer, filename: string, contentType: string): Promise<Warranty>;
  deleteWarranty(id: string): Promise<boolean>;
  /** Descarga un ticket a partir de la URL firmada que devuelve la API (/api/receipts/...). */
  downloadReceipt(url: string): Promise<ArrayBuffer>;
  monthly(months: number): Promise<MonthTotal[]>;
  exportCsv(scope?: ExportScope): Promise<ArrayBuffer>;
  categoryUsage(): Promise<CategoryUsage[]>;
  createCategory(input: Required<CategoryInput>): Promise<Category>;
  updateCategory(id: string, input: CategoryInput): Promise<Category>;
  /** Con `moveTo` reasigna movimientos y recurrentes antes de borrar. Devuelve cuantos movio. */
  deleteCategory(id: string, moveTo?: string): Promise<number>;
}

export class LedgerApi implements LedgerClient {
  constructor(
    private readonly baseUrl: string,
    private readonly key: string,
  ) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(`${this.baseUrl}/api/bot${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), "X-Bot-Key": this.key },
      signal: AbortSignal.timeout(20_000),
    });
    return res;
  }

  private async json<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { message?: string; error?: string };
        detail = body.message ?? body.error ?? "";
      } catch {
        // cuerpo no JSON
      }
      throw new ApiError(res.status, detail || `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }

  async categories(): Promise<Category[]> {
    return this.json<Category[]>(await this.request("/categories"));
  }

  async createTransaction(input: NewTx): Promise<Tx> {
    return this.json<Tx>(
      await this.request("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
  }

  async lastTransaction(): Promise<Tx | null> {
    const res = await this.request("/transactions/last");
    if (res.status === 404) return null;
    return this.json<Tx>(res);
  }

  async attachReceipt(id: string, bytes: ArrayBuffer, filename: string, contentType: string): Promise<Tx> {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: contentType }), filename);
    return this.json<Tx>(
      await this.request(`/transactions/${encodeURIComponent(id)}/receipt`, { method: "POST", body: form }),
    );
  }

  async deleteTransaction(id: string): Promise<boolean> {
    const res = await this.request(`/transactions/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.status === 404) return false;
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
    return true;
  }

  async summary(range?: SummaryRange): Promise<Summary> {
    const params = new URLSearchParams();
    if (range && "month" in range) params.set("month", range.month);
    if (range && "from" in range) {
      params.set("from", range.from);
      params.set("to", range.to);
    }
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return this.json<Summary>(await this.request(`/summary${query}`));
  }

  async suggestCategory(note: string, type: "expense" | "income"): Promise<Suggestion | null> {
    const res = await this.request(`/suggest?${new URLSearchParams({ note, type }).toString()}`);
    if (res.status === 404) return null;
    return this.json<Suggestion>(res);
  }

  async searchTransactions(q: string, limit = 8): Promise<Tx[]> {
    return this.json<Tx[]>(await this.request(`/transactions/search?${new URLSearchParams({ q, limit: String(limit) })}`));
  }

  async editTransaction(id: string, edit: TxEdit): Promise<Tx> {
    return this.json<Tx>(
      await this.request(`/transactions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      }),
    );
  }

  async warranties(): Promise<Warranty[]> {
    return this.json<Warranty[]>(await this.request("/warranties"));
  }

  async createWarranty(input: NewWarranty): Promise<Warranty> {
    return this.json<Warranty>(
      await this.request("/warranties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
  }

  async attachWarrantyReceipt(id: string, bytes: ArrayBuffer, filename: string, contentType: string): Promise<Warranty> {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: contentType }), filename);
    return this.json<Warranty>(
      await this.request(`/warranties/${encodeURIComponent(id)}/receipt`, { method: "POST", body: form }),
    );
  }

  async deleteWarranty(id: string): Promise<boolean> {
    const res = await this.request(`/warranties/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.status === 404) return false;
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
    return true;
  }

  async downloadReceipt(url: string): Promise<ArrayBuffer> {
    if (!url.startsWith("/api/receipts/")) throw new ApiError(400, "URL de ticket no valida");
    const res = await fetch(`${this.baseUrl}${url}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
    return res.arrayBuffer();
  }

  async monthly(months: number): Promise<MonthTotal[]> {
    return this.json<MonthTotal[]>(await this.request(`/monthly?months=${months}`));
  }

  async exportCsv(scope?: ExportScope): Promise<ArrayBuffer> {
    const params = new URLSearchParams();
    if (scope && "month" in scope) params.set("month", scope.month);
    if (scope && "year" in scope) params.set("year", scope.year);
    const query = params.size > 0 ? `?${params.toString()}` : "";
    const res = await this.request(`/export${query}`);
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
    return res.arrayBuffer();
  }

  async categoryUsage(): Promise<CategoryUsage[]> {
    return this.json<CategoryUsage[]>(await this.request("/categories/usage"));
  }

  async createCategory(input: Required<CategoryInput>): Promise<Category> {
    return this.json<Category>(
      await this.request("/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
  }

  async updateCategory(id: string, input: CategoryInput): Promise<Category> {
    return this.json<Category>(
      await this.request(`/categories/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
  }

  async deleteCategory(id: string, moveTo?: string): Promise<number> {
    const query = moveTo ? `?${new URLSearchParams({ moveTo }).toString()}` : "";
    const body = await this.json<{ moved: number }>(
      await this.request(`/categories/${encodeURIComponent(id)}${query}`, { method: "DELETE" }),
    );
    return body.moved;
  }
}
