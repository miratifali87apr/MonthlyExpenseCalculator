export type Category =
  | 'loan' | 'insurance' | 'utility' | 'council_rates'
  | 'bas' | 'school_fees' | 'credit_card' | 'car'
  | 'pm_fees' | 'maintenance' | 'letting_fee' | 'other';

export type Frequency = 'monthly' | 'quarterly' | 'weekly' | 'fortnightly' | 'ad_hoc';

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'funded' | 'partial';

export type IncomeType = 'salary' | 'rental' | 'reimbursement' | 'other';

export type ReimbursementStatus = 'pending' | 'received';

export interface Property {
  id: number;
  name: string;
  address?: string;
  tenant_liable_for_water: boolean;
  weekly_rent?: number;
  pm_fee_pct?: number;
  purchase_price?: number;
  loan_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface RecurringTemplate {
  id: number;
  name: string;
  category: Category;
  amount: number;
  frequency: Frequency;
  day_of_month?: number;
  property_id?: number;
  property?: Property;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExpenseItem {
  id: number;
  name: string;
  category: Category;
  amount: number;
  amount_paid?: number;
  due_date: string;
  paid_date?: string;
  status: PaymentStatus;
  notes?: string;
  property_id?: number;
  property?: Property;
  template_id?: number;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

export interface IncomeItem {
  id: number;
  name: string;
  type: IncomeType;
  amount: number;
  received_date?: string;
  expected_date?: string;
  property_id?: number;
  property?: Property;
  reimbursement_status?: ReimbursementStatus;
  notes?: string;
  is_recurring: boolean;
  frequency?: Frequency;
  created_at: string;
  updated_at: string;
}

export interface CashflowTrend {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface DashboardSummary {
  total_monthly_income: number;
  total_monthly_expenses: number;
  net_cashflow: number;
  upcoming_7_days: ExpenseItem[];
  upcoming_30_days: ExpenseItem[];
  overdue_items: ExpenseItem[];
  next_unfunded: ExpenseItem[];
  pending_reimbursements: IncomeItem[];
  cashflow_trend: CashflowTrend[];
}

export interface PropertySummary {
  property: Property;
  total_income: number;
  total_expenses: number;
  net_cashflow: number;
  expense_breakdown: Record<string, number>;
}

export interface User {
  id: number;
  email: string;
  name: string;
}
