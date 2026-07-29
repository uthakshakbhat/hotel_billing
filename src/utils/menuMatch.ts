import type { MenuItem } from '../types';

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

// Simple Levenshtein distance for fuzzy fallback matching
function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Finds the best-matching real menu item for a spoken name.
// Returns null if nothing is close enough to be trusted.
export function matchMenuItem(spokenName: string, menuItems: MenuItem[]): MenuItem | null {
  const target = normalize(spokenName);
  if (!target) return null;

  // 1. Exact match
  let match = menuItems.find((m) => normalize(m.name) === target);
  if (match) return match;

  // 2. One contains the other (e.g. "coffee" matches "Filter Coffee")
  match = menuItems.find((m) => {
    const n = normalize(m.name);
    return n.includes(target) || target.includes(n);
  });
  if (match) return match;

  // 3. Fuzzy fallback — closest by edit distance, only if reasonably close
  let best: MenuItem | null = null;
  let bestScore = Infinity;
  for (const m of menuItems) {
    const dist = levenshtein(target, normalize(m.name));
    const threshold = Math.max(2, Math.floor(normalize(m.name).length * 0.35));
    if (dist <= threshold && dist < bestScore) {
      best = m;
      bestScore = dist;
    }
  }
  return best;
}