import { supabase } from '../lib/supabase';
import type { MenuItem, TableOrder } from '../types';

// Add this bill's total to today's running total in daily_sales (upsert).
async function recordDailySale(createdAt: string, amount: number) {
  const saleDate = createdAt.split('T')[0];
  const { data: existing } = await supabase.from('daily_sales').select('*').eq('sale_date', saleDate).maybeSingle();
  if (existing) {
    await supabase
      .from('daily_sales')
      .update({
        total_amount: parseFloat(existing.total_amount) + amount,
        order_count: existing.order_count + 1,
      })
      .eq('sale_date', saleDate);
  } else {
    await supabase.from('daily_sales').insert([{ sale_date: saleDate, total_amount: amount, order_count: 1 }]);
  }
}

// Saves a printed bill: one row in `orders`, one row per line item in
// `order_items`, and updates the permanent date-wise `daily_sales` ledger.
export async function saveOrderToDB(tableNumber: number, tableOrder: TableOrder, menuItems: MenuItem[]) {
  const entries = Object.entries(tableOrder).filter(([, qty]) => qty > 0);
  const total = entries.reduce((sum, [itemId, qty]) => {
    const item = menuItems.find((m) => m.id === Number(itemId));
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert([{ table_number: tableNumber, total, status: 'printed' }])
    .select()
    .single();
  if (orderErr) throw orderErr;

  const orderItems = entries
    .map(([itemId, qty]) => {
      const item = menuItems.find((m) => m.id === Number(itemId));
      if (!item) return null;
      return {
        order_id: order.id,
        menu_item_id: item.id,
        item_name: item.name,
        item_price: item.price,
        quantity: qty,
        subtotal: item.price * qty,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
  if (itemsErr) throw itemsErr;

  await recordDailySale(order.created_at, total);

  return order.id;
}