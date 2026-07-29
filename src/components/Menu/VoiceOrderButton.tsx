import { useState } from 'react';
import type { MenuItem } from '../../types';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { matchMenuItem } from '../../utils/menuMatch';

interface VoiceOrderButtonProps {
  menuItems: MenuItem[];
  onAddItem: (item: MenuItem) => void; // adds ONE unit to the current table
}

export function VoiceOrderButton({ menuItems, onAddItem }: VoiceOrderButtonProps) {
  const { listening, supported, startListening } = useSpeechToText();
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleVoiceResult(transcript: string) {
    setProcessing(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript }),
      });
      const data = await res.json();
      const parsed: { name: string; quantity: number }[] = data.items ?? [];

      if (parsed.length === 0) {
        setFeedback(`Heard: "${transcript}" — couldn't identify any items.`);
        return;
      }

      const added: string[] = [];
      const notFound: string[] = [];

      for (const { name, quantity } of parsed) {
        const match = matchMenuItem(name, menuItems);
        if (match) {
          for (let i = 0; i < Math.max(1, Math.round(quantity)); i++) onAddItem(match);
          added.push(`${quantity}x ${match.name}`);
        } else {
          notFound.push(name);
        }
      }

      let summary = '';
      if (added.length) summary += `Added: ${added.join(', ')}`;
      if (notFound.length) summary += `${summary ? ' — ' : ''}Not found: ${notFound.join(', ')}`;
      setFeedback(summary);
    } catch (e) {
      console.error(e);
      setFeedback('Could not process that order — try again.');
    } finally {
      setProcessing(false);
    }
  }

  function handleClick() {
    if (!supported) {
      setFeedback('Voice input needs Chrome browser (not supported here).');
      return;
    }
    setFeedback(null);
    startListening(handleVoiceResult, (msg) => setFeedback(msg));
  }

  return (
    <div style={{ padding: '0 14px 10px' }}>
      <button
        className="cf-btn"
        onClick={handleClick}
        disabled={listening || processing}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {listening ? '🎙️ Listening...' : processing ? '⏳ Processing...' : '🎤 Speak Order'}
      </button>
      {feedback && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>{feedback}</p>
      )}
    </div>
  );
}