import { useCallback, useRef, useState } from 'react';

export function useSpeechToText() {
  const [listening, setListening] = useState(false);
  const [supported] = useState(
    typeof window !== 'undefined' && !!(window as any).webkitSpeechRecognition || !!(window as any).SpeechRecognition
  );
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback((onResult: (transcript: string) => void, onError?: (msg: string) => void) => {
    if (!supported) {
      onError?.('Voice input is not supported in this browser. Try Chrome.');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (e: any) => {
      setListening(false);
      onError?.(e.error === 'no-speech' ? 'Did not catch that — try again.' : `Voice error: ${e.error}`);
    };
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { listening, supported, startListening, stopListening };
}