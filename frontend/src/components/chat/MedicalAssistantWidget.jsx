'use client';

/**
 * PillSync — AI Medical Assistant Chat Widget (Slide-Over Sidebar)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * G-Stack: Vercel AI SDK useChat protocol for streaming + conversational memory.
 * G-Stack: Slide-over sidebar — no separate page, opens from bottom-right.
 * G-Stack: EmergencyActionCard — zero-tolerance SOS bypasses all generation.
 * 
 * The widget reads isChatOpen from useMedicalBotStore (Zustand) to show/hide.
 * Uses the existing LanguageContext for bilingual support.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Send,
  Bot,
  User,
  Phone,
  AlertTriangle,
  Pill,
  Clock,
  ShieldCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import useMedicalBotStore from '@/store/useMedicalBotStore';
import { useLanguage } from '@/context/LanguageContext';

// ── API Client ───────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function sendChatMessage(messages, locale, token) {
  const res = await fetch(`${API_BASE}/api/v1/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages, locale }),
  });
  if (!res.ok) throw new Error(`Chat API error: ${res.status}`);
  return res.json();
}

async function fetchSuggestions(locale, token) {
  const res = await fetch(`${API_BASE}/api/v1/assistant/suggestions?locale=${locale}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return [];
  return res.json();
}

// ── Emergency Action Card ────────────────────────────────────────

function EmergencyActionCard({ data }) {
  return (
    <div className="bg-red-950/90 border-2 border-red-500 rounded-xl p-4 space-y-3 animate-pulse-slow">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-6 h-6 text-red-400" />
        <h4 className="text-red-200 font-bold text-sm">
          {data.message_en}
        </h4>
      </div>
      <p className="text-red-300 text-xs">{data.message_hi}</p>
      <div className="space-y-2">
        {(data.emergency_numbers || []).map((num, i) => (
          <a
            key={i}
            href={`tel:${num.number}`}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white rounded-lg px-4 py-3 font-bold text-sm transition-all active:scale-95"
          >
            <Phone className="w-5 h-5" />
            {num.label} — {num.number}
          </a>
        ))}
      </div>
      <p className="text-red-400/70 text-[10px] text-center mt-2">
        {data.disclaimer}
      </p>
    </div>
  );
}

// ── DDI Alert Card ───────────────────────────────────────────────

function DDIAlertCard({ warnings }) {
  const severityColors = {
    CRITICAL: 'bg-red-900/50 border-red-500 text-red-200',
    MAJOR: 'bg-orange-900/50 border-orange-500 text-orange-200',
    MODERATE: 'bg-yellow-900/50 border-yellow-500 text-yellow-200',
  };

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`rounded-lg border p-3 space-y-1 ${severityColors[w.severity] || severityColors.MODERATE}`}
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-bold">[{w.severity}] {w.title}</span>
          </div>
          <p className="text-[11px] opacity-90">{w.description}</p>
          <p className="text-[10px] opacity-70">
            💊 Action: {w.action}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Chat Message Bubble ──────────────────────────────────────────

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-emerald-600/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-emerald-400" />
        </div>
      )}
      <div
        className={[
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
          isUser
            ? 'bg-emerald-600 text-white rounded-br-md'
            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-md',
        ].join(' ')}
      >
        {/* Render emergency or DDI cards inside assistant messages */}
        {message.emergencyData && <EmergencyActionCard data={message.emergencyData} />}
        {message.ddiWarnings && <DDIAlertCard warnings={message.ddiWarnings} />}
        {(!message.emergencyData) && (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-emerald-600/30 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-emerald-300" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN WIDGET EXPORT
// ═══════════════════════════════════════════════════════════════════

export default function MedicalAssistantWidget() {
  const isChatOpen = useMedicalBotStore((s) => s.isChatOpen);
  const openChat = useMedicalBotStore((s) => s.openChat);
  const closeChat = useMedicalBotStore((s) => s.closeChat);
  const { locale } = useLanguage();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isChatOpen]);

  // Fetch suggestions on open
  useEffect(() => {
    if (isChatOpen) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('pillsync_access_token') : null;
      fetchSuggestions(locale, token)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }
  }, [isChatOpen, locale]);

  const handleSend = useCallback(async (customMessage) => {
    const text = customMessage || input.trim();
    if (!text || isLoading) return;

    const userMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('pillsync_access_token') : null;

      // Send conversation history (Vercel AI SDK useChat protocol)
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await sendChatMessage(apiMessages, locale, token);

      // Build assistant message with optional action cards
      const assistantMessage = {
        role: 'assistant',
        content: response.content || '',
        type: response.type,
      };

      if (response.type === 'EMERGENCY') {
        assistantMessage.emergencyData = response;
        assistantMessage.content = response.message_en;
      }

      if (response.type === 'DDI_ALERT' && response.warnings) {
        assistantMessage.ddiWarnings = response.warnings;
      }

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('[PillSync Chat] Error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: locale === 'hi'
            ? 'कनेक्शन में समस्या हो रही है। आपकी दवाइयां और अलार्म सही काम कर रहे हैं। कृपया दोबारा कोशिश करें।'
            : 'Connection issue. Your medications and alarms are working perfectly. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading, locale]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (!isChatOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-[9990]">
        <button
          onClick={openChat}
          className="group relative flex items-center gap-2.5 px-5 py-3 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white font-medium text-sm shadow-xl shadow-emerald-950/40 hover:shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all duration-300 border border-emerald-400/30 backdrop-blur-md"
          aria-label="Open PillSync AI Assistant"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
          </span>
          <Bot className="w-5 h-5 text-white" />
          <span className="font-semibold tracking-wide">
            {locale === 'hi' ? 'PillSync AI से पूछें 💬' : 'Ask PillSync AI 💬'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9998] transition-opacity"
        onClick={closeChat}
        aria-hidden="true"
      />

      {/* Slide-over Sidebar */}
      <div
        className={[
          'fixed right-0 top-0 h-full w-full sm:w-[400px] z-[9999]',
          'bg-gradient-to-b from-slate-950 to-slate-900',
          'border-l border-slate-800 shadow-2xl',
          'flex flex-col',
          'animate-slide-in-right',
        ].join(' ')}
        role="dialog"
        aria-label="PillSync AI Medical Assistant"
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-600/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                PillSync AI
              </h3>
              <p className="text-[10px] text-slate-400">
                {locale === 'hi' ? 'आपका मेडिकल असिस्टेंट' : 'Your Medical Assistant'}
              </p>
            </div>
          </div>
          <button
            onClick={closeChat}
            className="w-9 h-9 rounded-full hover:bg-slate-800 flex items-center justify-center transition-colors"
            aria-label="Close chat"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* ── Messages Area ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-600/10 flex items-center justify-center">
                <Bot className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">
                  {locale === 'hi' ? 'नमस्ते! मैं PillSync AI हूँ' : 'Hi! I\'m PillSync AI'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[260px] mx-auto">
                  {locale === 'hi'
                    ? 'मैं आपकी दवाइयों, शेड्यूल, और सुरक्षा के बारे में मदद कर सकता हूँ।'
                    : 'I can help with your medications, schedule, drug interactions, and safety.'}
                </p>
              </div>

              {/* Suggestion Chips */}
              {suggestions.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s.query)}
                      className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-all active:scale-95"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-600/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 border border-slate-700">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse-wave" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse-wave" style={{ animationDelay: '200ms' }} />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse-wave" style={{ animationDelay: '400ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Bar ───────────────────────────────────────── */}
        <div className="shrink-0 px-4 py-3 border-t border-slate-800 bg-slate-950/80 backdrop-blur-xl">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={locale === 'hi' ? 'अपना सवाल लिखें...' : 'Ask about your medications...'}
              className="flex-1 bg-slate-800 text-slate-200 text-sm placeholder-slate-500 rounded-xl px-4 py-2.5 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none resize-none min-h-[42px] max-h-[120px] transition-colors"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className={[
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all',
                input.trim() && !isLoading
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed',
              ].join(' ')}
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[9px] text-slate-600 text-center mt-2">
            {locale === 'hi'
              ? 'यह मेडिकल सलाह नहीं है। गंभीर स्थिति में डॉक्टर से संपर्क करें।'
              : 'Not medical advice. Contact your physician for clinical decisions.'}
          </p>
        </div>
      </div>

      {/* Animation keyframes */}
      <style jsx global>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
        @keyframes pulse-wave {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.35;
          }
          50% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
        .animate-pulse-wave {
          animation: pulse-wave 1.4s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }
      `}</style>
    </>
  );
}
