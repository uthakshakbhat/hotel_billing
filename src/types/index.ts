export interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  user_id: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number;
  item_name: string;
  item_price: number;
  quantity: number;
  subtotal: number;
  user_id: string;
}

export interface Order {
  id: number;
  table_number: number;
  total: number;
  status: 'printed' | 'paid';
  created_at: string;
  user_id: string;
}

export interface Employee {
  id: number;
  name: string;
  role: string;
  active: boolean;
  user_id: string;
}

export interface EmployeePayment {
  id: number;
  employee_id: number;
  amount: number;
  note: string;
  paid_date: string;
  created_at: string;
  user_id: string;
}

export interface CashExpense {
  id: number;
  description: string;
  amount: number;
  expense_date: string;
  created_at: string;
  user_id: string;
}

export interface DailySale {
  id: number;
  sale_date: string;
  total_amount: number;
  order_count: number;
  user_id: string;
}

export interface RestaurantSettings {
  user_id: string;
  hotel_name: string;
  upi_id: string;
  created_at: string;
}

export type TableOrder = Record<number, number>;