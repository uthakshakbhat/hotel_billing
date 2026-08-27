import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Employee, EmployeePayment, CashExpense, DailySale } from '../types';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function useLedger() {
  const [ledgerDate, setLedgerDateState] = useState(todayISO());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<EmployeePayment[]>([]);
  const [expenses, setExpenses] = useState<CashExpense[]>([]);
  const [daySale, setDaySale] = useState<DailySale | null>(null);
  const [loading, setLoading] = useState(false);

  const loadEmployees = useCallback(async () => {
    const { data } = await supabase.from('employees').select('*').order('name');
    setEmployees(data ?? []);
  }, []);

  const loadDayData = useCallback(async (date: string) => {
    setLoading(true);
    const [{ data: pay }, { data: exp }, { data: sale }] = await Promise.all([
      supabase.from('employee_payments').select('*').eq('paid_date', date).order('created_at', { ascending: false }),
      supabase.from('cash_expenses').select('*').eq('expense_date', date).order('created_at', { ascending: false }),
      supabase.from('daily_sales').select('*').eq('sale_date', date).maybeSingle(),
    ]);
    setPayments(pay ?? []);
    setExpenses(exp ?? []);
    setDaySale(sale ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    loadDayData(ledgerDate);
  }, [ledgerDate, loadDayData]);

  function setLedgerDate(date: string) {
    setLedgerDateState(date);
  }

  function changeLedgerDate(delta: number) {
    const d = new Date(ledgerDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setLedgerDateState(d.toISOString().split('T')[0]);
  }

  async function addPayment(employeeId: number, amount: number, note: string) {
    const { error } = await supabase
      .from('employee_payments')
      .insert([{ employee_id: employeeId, amount, note, paid_date: ledgerDate }]);
    if (!error) await loadDayData(ledgerDate);
    return { error: error?.message ?? null };
  }

  async function addExpense(description: string, amount: number) {
    const { error } = await supabase
      .from('cash_expenses')
      .insert([{ description, amount, expense_date: ledgerDate }]);
    if (!error) await loadDayData(ledgerDate);
    return { error: error?.message ?? null };
  }

  async function addEmployee(name: string, role: string) {
    const { error } = await supabase.from('employees').insert([{ name, role, active: true }]);
    if (!error) await loadEmployees();
    return { error: error?.message ?? null };
  }

  async function toggleEmployeeActive(id: number, active: boolean) {
    await supabase.from('employees').update({ active }).eq('id', id);
    await loadEmployees();
  }

  const totalIncome = daySale ? parseFloat(String(daySale.total_amount)) : 0;
  const totalPayments = payments.reduce((s, p) => s + parseFloat(String(p.amount)), 0);
  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const totalOut = totalPayments + totalExpenses;
  const balance = totalIncome - totalOut;

  return {
    ledgerDate,
    setLedgerDate,
    changeLedgerDate,
    employees,
    payments,
    expenses,
    daySale,
    loading,
    totalIncome,
    totalPayments,
    totalExpenses,
    totalOut,
    balance,
    addPayment,
    addExpense,
    addEmployee,
    toggleEmployeeActive,
  };
}