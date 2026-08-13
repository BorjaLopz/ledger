export type TransactionType = "expense" | "income";

export interface Category {
	id: string;
	uid: string;
	name: string;
	color: string;
	icon: string;
	type: TransactionType;
}

export interface Transaction {
	id: string;
	uid: string;
	type: TransactionType;
	amount: number;
	categoryId: string;
	date: string;
	note: string;
	receiptUrl: string | null;
	recurringId: string | null;
	createdAt: string;
}

export type RecurrenceFrequency = "weekly" | "monthly" | "yearly";

export interface RecurringPayment {
	id: string;
	uid: string;
	type: TransactionType;
	amount: number;
	categoryId: string;
	frequency: RecurrenceFrequency;
	nextDate: string;
	active: boolean;
	note: string;
}

export interface Debt {
	id: string;
	uid: string;
	name: string;
	totalAmount: number;
	paidAmount: number;
	installments: number;
	dueDate: string;
}

export interface NetWorthItem {
	name: string;
	amount: number;
}

export interface NetWorthEntry {
	id: string;
	uid: string;
	date: string;
	items: NetWorthItem[];
	total: number;
}
