import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { MenuItem } from '../types';

export function useMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMenu() {
    setLoading(true);
    // No need to filter by user_id manually — RLS only returns rows
    // belonging to whoever is currently logged in.
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category')
      .order('name');

    if (error) {
      console.error('Failed to load menu:', error);
      setError(error.message);
    } else {
      setItems(data ?? []);
      setError(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadMenu();
  }, []);

  return { items, loading, error, reload: loadMenu };
}