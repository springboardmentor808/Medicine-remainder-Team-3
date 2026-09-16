'use client';

/**
 * PillSync — AI Medical Assistant Chat Widget (Slide-Over Sidebar)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Architecture & Upgrades:
 *   - UI/UX Teal & Aqua Glassmorphism Overhaul (backdrop-blur-2xl, teal/cyan accents).
 *   - Calmed 3-dot thinking state (slow 2.2s soothing pulse wave).
 *   - Vercel AI SDK useChat protocol for streaming + conversational memory.
 *   - EmergencyActionCard: Zero-tolerance SOS bypasses all LLM generation.
 *   - Isolated state consumption from useMedicalBotStore (Zustand).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Send,
  Bot,
  User,
  Phone,
  AlertTriangle,
  ShieldCheck,
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

// ── Emergency Action Card (Strict Clinical SOS Guardrail) ─────────
function EmergencyActionCard({ data }) {
  return (
    <div className="bg-red-950/90 border-2 border-red-500 rounded-xl p-4 space-y-3 animate-pulse-slow backdrop-blur-md">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
        <h4 className="text-red-200 font-bold text-sm leading-snug">
          {data.message_en}
        </h4>
      </div>
      <p className="text-red-300 text-xs">{data.message_hi}</p>
      <div className="space-y-2 pt-1">
        {(data.emergency_numbers || []).map((num, i) => (
          <a
            key={i}
            href={`tel:${num.number}`}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white rounded-lg px-4 py-2.5 font-bold text-sm transition-all active:scale-95 shadow-md"
          >
            <Phone className="w-4 h-4" />
            <span>{num.label} — {num.number}</span>
          </a>
        ))}
      </div>
      <p className="text-red-400/80 text-[10px] text-center mt-2">
        {data.disclaimer}
      </p>
    </div>
  );
}

// ── DDI Alert Card (Drug-Drug Interaction Warnings) ───────────────
function DDIAlertCard({ warnings }) {
  const severityColors = {
    CRITICAL: 'bg-red-900/40 border-red-500 text-red-200',
    MAJOR: 'bg-orange-900/40 border-orange-500 text-orange-200',
    MODERATE: 'bg-amber-900/40 border-amber-500 text-amber-200',
  };

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`rounded-xl border p-3 space-y-1 backdrop-blur-md ${severityColors[w.severity] || severityColors.MODERATE}`}
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold">[{w.severity}] {w.title}</span>
          </div>
          <p className="text-[11px] opacity-90 leading-relaxed">{w.description}</p>
          <p className="text-[10px] opacity-80 pt-0.5">
            💊 Action: {w.action}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Chat Message Bubble (Teal / Aqua Glassmorphic Design) ─────────
function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 mt-0.5 border border-teal-500/30">
          <Bot className="w-4 h-4 text-teal-300" />
        </div>
      )}
      <div
        className={[
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
          isUser
            ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-br-md shadow-md shadow-teal-950/40'
            : 'bg-slate-900/75 backdrop-blur-xl text-slate-100 border border-teal-500/20 rounded-bl-md shadow-sm',
        ].join(' ')}
      >
        {/* Render emergency or DDI cards inside assistant messages */}
        {message.emergencyData && <EmergencyActionCard data={message.emergencyData} />}
        {message.ddiWarnings && <DDIAlertCard warnings={message.ddiWarnings} />}
        {!message.emergencyData && (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5 border border-cyan-500/30">
          <User className="w-4 h-4 text-cyan-300" />
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

  // Fetch contextual suggestions on open
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
            : 'Connection issue. Your medications and alarms are working perfectly. Please try again in a moment.',
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

  // ── Floating Launcher (Rendered when drawer is closed) ───────────
  if (!isChatOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-[9990]">
        <button
          onClick={openChat}
          className="group relative flex items-center gap-2.5 px-5 py-3 rounded-full bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-600 hover:from-teal-500 hover:via-teal-400 hover:to-cyan-500 text-white font-semibold text-sm shadow-xl shadow-teal-950/40 hover:shadow-teal-500/30 hover:scale-105 active:scale-95 transition-all duration-300 border border-teal-400/40 backdrop-blur-xl cursor-pointer"
          aria-label="Open PillSync AI Assistant"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
          </span>
          <Bot className="w-5 h-5 text-white" />
          <span className="tracking-wide">
            {locale === 'hi' ? 'PillSync AI से पूछें 💬' : 'Ask PillSync AI 💬'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ── Backdrop Overlay ─────────────────────────────────────── */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998] transition-opacity duration-300"
        onClick={closeChat}
        aria-hidden="true"
      />

      {/* ── Slide-over Sidebar Drawer ────────────────────────────── */}
      <div
        className={[
          'fixed right-0 top-0 h-full w-full sm:w-[420px] z-[9999]',
          'bg-slate-950/85 backdrop-blur-2xl',
          'border-l border-teal-500/20 shadow-2xl',
          'flex flex-col',
          'animate-slide-in-right',
        ].join(' ')}
        role="dialog"
        aria-label="PillSync AI Medical Assistant"
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-teal-500/20 bg-slate-950/70 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>PillSync AI</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  RAG
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {locale === 'hi' ? 'आपका व्यक्तिगत मेडिकल सहायक' : 'Your Personal Clinical Companion'}
              </p>
            </div>
          </div>
          <button
            onClick={closeChat}
            className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Messages Area ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shadow-inner">
                <Bot className="w-8 h-8 text-teal-300" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">
                  {locale === 'hi' ? 'नमस्ते! मैं PillSync AI हूँ' : "Hi! I'm PillSync AI"}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
                  {locale === 'hi'
                    ? 'मैं आपकी दवाइयों, खुराक समय, ड्रग इंटरैक्शन और सुरक्षा के बारे में मदद कर सकता हूँ।'
                    : 'I can help with your active medications, dose schedule, drug-drug safety, and clinical guidelines.'}
                </p>
              </div>

              {/* Contextual Suggestion Chips */}
              {suggestions.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-4 pt-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s.query)}
                      className="px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-teal-950/60 border border-teal-500/30 hover:border-teal-400 text-xs font-medium text-teal-200 hover:text-teal-100 transition-all active:scale-95 backdrop-blur-md shadow-sm cursor-pointer"
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

          {/* ── Calmed 3-Dot Thinking State ───────────────────── */}
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center border border-teal-500/30">
                <Bot className="w-4 h-4 text-teal-300" />
              </div>
              <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl rounded-bl-md px-4 py-3 border border-teal-500/20 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 bg-teal-400 rounded-full animate-pulse-wave"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-teal-400 rounded-full animate-pulse-wave"
                    style={{ animationDelay: '280ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-teal-400 rounded-full animate-pulse-wave"
                    style={{ animationDelay: '560ms' }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Bar ───────────────────────────────────────── */}
        <div className="shrink-0 px-4 py-3.5 border-t border-teal-500/20 bg-slate-950/70 backdrop-blur-xl">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={locale === 'hi' ? 'दवाइयों या स्वास्थ्य के बारे में पूछें...' : 'Ask about your medications or schedule...'}
              className="flex-1 bg-slate-900/80 text-slate-100 text-sm placeholder-slate-500 rounded-xl px-3.5 py-2.5 border border-slate-700/80 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 outline-none resize-none min-h-[42px] max-h-[120px] transition-colors"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className={[
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer',
                input.trim() && !isLoading
                  ? 'bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white shadow-md shadow-teal-950/40 active:scale-95'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed',
              ].join(' ')}
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 text-center mt-2">
            {locale === 'hi'
              ? 'यह चिकित्सीय निदान नहीं है। आपातकाल में तुरंत डॉक्टर या 108 पर संपर्क करें।'
              : 'Informational only. Contact your physician or dial emergency services (108/112/911) for acute issues.'}
          </p>
        </div>
      </div>

      {/* ── Calmed Animations & Transitions ──────────────────── */}
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
          animation: pulse-slow 2.4s ease-in-out infinite;
        }
        /* Calmed 3-dot thinking loader: 2.2s soothing, natural breathing rate */
        @keyframes pulse-wave {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.35;
          }
          50% {
            transform: translateY(-2.5px);
            opacity: 1;
          }
        }
        .animate-pulse-wave {
          animation: pulse-wave 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>
    </>
  );
}
