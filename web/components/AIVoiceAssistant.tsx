"use client";

import React, { useState, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, X, Loader2, Volume2, CheckCircle2 } from 'lucide-react';
import { processVoiceOrText } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';

export default function AIVoiceAssistant() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  // Check global system setting and user-specific module permission
  const userHasAiPerm = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'TEAM_ADMIN' || user?.module_permissions?.AI !== false;
  if (!user || settings?.module_ai_assistant_enabled !== true || !userHasAiPerm) return null;


  const startRecording = async () => {
    setError(null);
    setResult(null);

    // Try native Web Speech API (on-device fast German speech recognition)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'de-DE';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognitionRef.current = recognition;

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript) {
            setTextInput(currentTranscript);
          }
        };

        recognition.onend = async () => {
          setIsRecording(false);
          const finalPrompt = textInput.trim();
          if (finalPrompt) {
            await executeTextPrompt(finalPrompt);
          }
        };

        recognition.onerror = (err: any) => {
          console.warn('WebSpeech API error, falling back to MediaRecorder:', err);
          fallbackMediaRecorder();
        };

        recognition.start();
        setIsRecording(true);
        return;
      } catch (e) {
        console.warn('SpeechRecognition failed to start, using MediaRecorder fallback:', e);
      }
    }

    fallbackMediaRecorder();
  };

  const fallbackMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleSendAudio(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      setError('Mikrofon-Zugriff fehlgeschlagen. Bitte Berechtigung erteilen.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const executeTextPrompt = async (promptText: string) => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const formData = new FormData();
      formData.append('text', promptText);

      const res = await processVoiceOrText(formData);
      setResult(res);

      if (res?.message && 'speechSynthesis' in window) {
        speakText(res.message);
      }
    } catch (err: any) {
      console.error('Voice processing error:', err);
      setError(err?.response?.data?.detail || err?.message || 'Fehler bei der KI-Verarbeitung.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendAudio = async (audioBlob: Blob) => {
    try {
      setLoading(true);
      setError(null);
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'voice.webm');
      
      const res = await processVoiceOrText(formData);
      setResult(res);
      
      // Voice feedback via Text-to-Speech
      if (res?.message && 'speechSynthesis' in window) {
        speakText(res.message);
      }
    } catch (err: any) {
      console.error('Voice processing error:', err);
      setError(err?.response?.data?.detail || err?.message || 'Fehler bei der KI-Verarbeitung.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const formData = new FormData();
      formData.append('text', textInput);

      const res = await processVoiceOrText(formData);
      setResult(res);
      setTextInput('');

      // Voice feedback via Text-to-Speech
      if (res?.message && 'speechSynthesis' in window) {
        speakText(res.message);
      }
    } catch (err: any) {
      console.error('Text processing error:', err);
      setError(err?.response?.data?.detail || err?.message || 'Fehler bei der KI-Verarbeitung.');
    } finally {
      setLoading(false);
    }
  };

  const speakText = (text: string) => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS error:', e);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[99] flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3.5 text-xs font-bold text-white shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 border border-emerald-400/30"
        title="MatchTrack KI-Sprachassistent öffnen"
      >
        <Sparkles className="h-4 w-4 animate-pulse text-amber-300" />
        <span className="hidden sm:inline">KI-Sprachassistent</span>
        <Mic className="h-4 w-4" />
      </button>

      {/* Assistant Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">MatchTrack KI-Assistent</h3>
                  <p className="text-[11px] text-zinc-400">Sprachbefehle, Anwesenheit & Spielereinschätzungen</p>
                </div>
              </div>
              <button
                onClick={() => { setIsOpen(false); setResult(null); setError(null); }}
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Examples */}
            <div className="space-y-1.5 text-[11px] text-zinc-400 bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800">
              <p className="font-bold text-zinc-300">💡 Beispiele für Sprachbefehle:</p>
              <ul className="space-y-1 list-disc list-inside text-zinc-400">
                <li><span className="text-emerald-400">"Folgende Spieler waren beim Training: Rio, Matheo, Theo, Julius"</span></li>
                <li><span className="text-blue-400">"Trage für Max Mustermann ein: Sehr starke Zweikampfführung, Note 2"</span></li>
                <li><span className="text-amber-400">"Lege Dienstag 18:30 Taktiktraining am Hauptplatz an"</span></li>
              </ul>
            </div>

            {/* Recording Controls */}
            <div className="flex flex-col items-center justify-center py-4 space-y-3">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={loading}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 border-2 border-emerald-500 text-emerald-400 shadow-xl transition-all hover:scale-110 hover:bg-emerald-500/20 active:scale-95 disabled:opacity-50"
                >
                  <Mic className="h-9 w-9" />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="relative flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-xl animate-pulse transition-all hover:scale-105"
                >
                  <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
                  <MicOff className="h-9 w-9 z-10" />
                </button>
              )}

              <p className="text-xs font-bold text-zinc-400">
                {isRecording ? '🔴 Aufnahme läuft... Klicken zum Stoppen' : 'Klicke auf das Mikrofon zum Sprechen'}
              </p>
            </div>

            {/* Text Input Fallback */}
            <form onSubmit={handleSendText} className="flex items-center gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Oder Sprachbefehl hier tippen..."
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !textInput.trim()}
                className="flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-center justify-center gap-3 p-4 bg-zinc-900/80 rounded-2xl border border-zinc-800 text-xs font-bold text-zinc-300 animate-pulse">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>KI verarbeitet Sprache & führt Aktion aus...</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs font-bold text-red-400">
                ⚠️ {error}
              </div>
            )}

            {/* Result Card */}
            {result && (
              <div className="space-y-3 p-4 bg-zinc-900 border border-emerald-500/30 rounded-2xl animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{result.title}</span>
                  </div>
                  {result.message && (
                    <button
                      onClick={() => speakText(result.message)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                      title="Vorlesen"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-zinc-300 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                  {result.message}
                </p>

                {result.transcript && (
                  <p className="text-[10px] text-zinc-500 italic">
                    Transkript: "{result.transcript}"
                  </p>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
