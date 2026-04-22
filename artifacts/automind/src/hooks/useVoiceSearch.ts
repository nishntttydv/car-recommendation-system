import { useEffect, useRef, useState } from "react";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

interface UseVoiceSearchOptions {
  value: string;
  silenceMs?: number;
  onTranscript: (value: string) => void;
  onAutoSubmit: (value: string) => void;
}

function detectLanguage(value: string): string {
  return /[\u0900-\u097F]/.test(value) ? "hi-IN" : "en-IN";
}

export function useVoiceSearch({
  value,
  silenceMs = 2500,
  onTranscript,
  onAutoSubmit,
}: UseVoiceSearchOptions) {
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcriptRef = useRef(value);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmitPendingRef = useRef(false);
  const isListeningRef = useRef(false);

  useEffect(() => {
    transcriptRef.current = value;
  }, [value]);

  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    const clearSilenceTimer = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };

    const queueAutoSubmit = () => {
      clearSilenceTimer();
      if (!transcriptRef.current.trim()) return;

      autoSubmitPendingRef.current = true;
      if (isListeningRef.current) {
        recognition.stop();
      } else {
        onAutoSubmit(transcriptRef.current.trim());
      }
    };

    const resetSilenceTimer = () => {
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        setVoiceMessage("Searching for your spoken query...");
        queueAutoSubmit();
      }, silenceMs);
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0]?.transcript ?? "";
      }

      const nextQuery = transcript.trim();
      if (!nextQuery) return;

      transcriptRef.current = nextQuery;
      onTranscript(nextQuery);
      setVoiceMessage("Listening...");
      resetSilenceTimer();
    };

    recognition.onerror = (event) => {
      clearSilenceTimer();
      autoSubmitPendingRef.current = false;
      isListeningRef.current = false;
      setIsListening(false);

      if (event.error === "not-allowed") {
        setVoiceMessage("Microphone permission is blocked.");
        return;
      }
      if (event.error === "no-speech") {
        setVoiceMessage("No speech detected. Try again.");
        return;
      }
      setVoiceMessage("Voice search stopped. Please try again.");
    };

    recognition.onend = () => {
      clearSilenceTimer();
      isListeningRef.current = false;
      setIsListening(false);

      if (autoSubmitPendingRef.current && transcriptRef.current.trim()) {
        autoSubmitPendingRef.current = false;
        onAutoSubmit(transcriptRef.current.trim());
        setVoiceMessage("Searching for your spoken query...");
        return;
      }

      setVoiceMessage((current) => current || "Voice search stopped.");
    };

    recognitionRef.current = recognition;
    setVoiceSupported(true);

    return () => {
      clearSilenceTimer();
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [onAutoSubmit, onTranscript, silenceMs]);

  function toggleVoiceSearch() {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setVoiceMessage("Voice search is not supported in this browser.");
      return;
    }

    if (isListeningRef.current) {
      autoSubmitPendingRef.current = false;
      recognition.stop();
      isListeningRef.current = false;
      setIsListening(false);
      setVoiceMessage("Voice search stopped.");
      return;
    }

    try {
      recognition.lang = detectLanguage(transcriptRef.current);
      autoSubmitPendingRef.current = false;
      setVoiceMessage("Listening...");
      isListeningRef.current = true;
      setIsListening(true);
      recognition.start();
    } catch {
      isListeningRef.current = false;
      setIsListening(false);
      setVoiceMessage("Microphone is busy. Please try once more.");
    }
  }

  return {
    isListening,
    voiceSupported,
    voiceMessage,
    toggleVoiceSearch,
  };
}
