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
}
