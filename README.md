# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

## BharatPe reconciliation setup

1. **Run the migration.** Open Supabase → SQL Editor → paste and run
   `supabase/sql/002_bharatpe_integration.sql`. This adds `payment_method`
   and `bharatpe_utr` to `orders`, and creates `bharatpe_transactions`.
2. **Deploy the edge function.** With the Supabase CLI:
   ```
   supabase functions deploy bharatpe-webhook --no-verify-jwt
   supabase secrets set BHARATPE_SHARED_SECRET=<pick a long random string>
   ```
   `--no-verify-jwt` matters here — without it, Supabase's own gateway rejects
   every request before it even reaches our code (since the Android app
   sends our custom shared-secret header, not a Supabase auth token). Our
   function does its own auth via `X-Shared-Secret`, so this is safe.
   (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are usually already
   available to functions on your project automatically — check
   Project Settings → Edge Functions if the function can't reach the DB.)
3. **Point the Android app at it.** In the Anuradha Bill Sync app on the
   BharatPe phone, set Webhook URL to
   `https://<your-project-ref>.supabase.co/functions/v1/bharatpe-webhook`
   (note: **not** `<ref>.functions.supabase.co` — that's not a real
   Supabase domain) and Shared Secret to the same string from step 2.
4. **Send a test event** from the app and confirm a row appears in
   `bharatpe_transactions` with `sender = 'TEST'`.

### What changed in the app
- Printing a bill now counts it toward the day's total immediately —
  there's no more manual "Mark as Paid" step.
- The UPI QR on every printed bill now embeds that order's ID
  (`AHB-<id>`) in the payment note, which is what lets a BharatPe payment
  be matched back to the exact bill instead of guessed at.
- **Order History** now shows two actions on an open bill: **Cash** (tag
  it as cash-collected, one tap) and **Miss Bill** (void a bill that was
  created by mistake — pulls it back out of the day's total).
- Orders auto-flip to "UPI CONFIRMED" once the matching BharatPe
  transaction arrives — no action needed for the normal case.

### Still open
`bharatpe_transactions` rows with `matched_order_id IS NULL` are the
"needs review" queue (walk-in UPI payments, ambiguous amount collisions).
There's no in-app screen for that queue yet — for now it's a query away in
the SQL editor. Say the word if you want a small tab added for it.
