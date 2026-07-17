import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Browser } from '@capacitor/browser';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import type { RestaurantSettings } from '../types';

interface AuthState {
  loading: boolean;
  user: User | null;
  settings: RestaurantSettings | null;
  needsSetup: boolean;
}

const DEEP_LINK_REDIRECT = 'hotelanuradha://login-callback';

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    settings: null,
    needsSetup: false,
  });

  async function loadSettingsForUser(user: User) {
    const { data: settings, error } = await supabase
      .from('restaurant_settings')
      .select('*')
      .maybeSingle();

    if (error) console.error('restaurant_settings lookup failed:', error);

    setState({
      loading: false,
      user,
      settings: settings ?? null,
      needsSetup: !settings,
    });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadSettingsForUser(session.user);
      else setState({ loading: false, user: null, settings: null, needsSetup: false });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) loadSettingsForUser(session.user);
      if (event === 'SIGNED_OUT') setState({ loading: false, user: null, settings: null, needsSetup: false });
    });

    // Only relevant on native (Android) — listens for the app being
    // reopened via the hotelanuradha://login-callback deep link.
    let urlListener: { remove: () => void } | undefined;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url.startsWith(DEEP_LINK_REDIRECT)) return;
        await Browser.close();

        // Supabase returns tokens in the URL fragment (#access_token=...)
        const hashIndex = url.indexOf('#');
        if (hashIndex === -1) return;
        const params = new URLSearchParams(url.substring(hashIndex + 1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }).then((l) => { urlListener = l; });
    }

    return () => {
      listener.subscription.unsubscribe();
      urlListener?.remove();
    };
  }, []);

  async function loginWithGoogle() {
    if (Capacitor.isNativePlatform()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: DEEP_LINK_REDIRECT, skipBrowserRedirect: true },
      });
      if (error) {
        alert('Sign-in failed: ' + error.message);
        return;
      }
      if (data?.url) await Browser.open({ url: data.url });
    } else {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
    }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function saveSetup(hotelName: string, upiId: string) {
    if (!state.user) return { error: 'Not logged in' };
    const { error } = await supabase.from('restaurant_settings').insert([
      { user_id: state.user.id, hotel_name: hotelName, upi_id: upiId },
    ]);
    if (error) return { error: error.message };
    setState((prev) => ({
      ...prev,
      settings: { user_id: state.user!.id, hotel_name: hotelName, upi_id: upiId, created_at: new Date().toISOString() },
      needsSetup: false,
    }));
    return { error: null };
  }

  return { ...state, loginWithGoogle, logout, saveSetup };
}