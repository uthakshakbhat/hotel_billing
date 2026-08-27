import { useState } from 'react';

interface SetupScreenProps {
  onSave: (hotelName: string, upiId: string) => Promise<{ error: string | null }>;
}

export function SetupScreen({ onSave }: SetupScreenProps) {
  const [hotelName, setHotelName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!hotelName.trim() || !upiId.trim()) {
      setError('Please fill in both fields');
      return;
    }
    setSaving(true);
    setError('');
    const result = await onSave(hotelName.trim(), upiId.trim());
    if (result.error) setError(result.error);
    setSaving(false);
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-icon">🏪</div>
        <h1>Set Up Your Restaurant</h1>
        <p>This is a fresh workspace — set your restaurant name and UPI ID to get started. Your menu starts empty.</p>

        <div className="setup-field">
          <label>Restaurant / Hotel Name</label>
          <input
            type="text"
            placeholder="e.g. Hotel Anuradha"
            value={hotelName}
            onChange={(e) => setHotelName(e.target.value)}
          />
        </div>

        <div className="setup-field">
          <label>UPI ID (for QR payments)</label>
          <input
            type="text"
            placeholder="yourname@bank"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
          />
        </div>

        {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button
          className="auth-google-btn"
          style={{ background: 'var(--gold)', color: '#0b1215' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
}