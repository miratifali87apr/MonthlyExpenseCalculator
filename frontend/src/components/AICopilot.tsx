'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, ChevronDown } from 'lucide-react';
import { chatApi } from '@/lib/api';

type Message = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Am I cashflow positive this month?',
  'Which property costs me the most?',
  'What bills are overdue?',
  'How much rental income do I earn?',
];

export function AICopilot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const userMessage: Message = { role: 'user', content: msg };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const history = next.slice(0, -1); // everything before the new message
      const { reply } = await chatApi.send(msg, history);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: "Sorry, I couldn't reach the server. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-2 bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-full shadow-lg shadow-indigo-500/30 px-4 py-3 text-sm font-semibold hover:scale-105 active:scale-95 transition-transform"
        aria-label="Open AI Copilot"
      >
        <Sparkles size={16} />
        <span className="hidden sm:inline">Ask AI</span>
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-36 right-4 md:bottom-20 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 flex flex-col overflow-hidden"
          style={{ height: 'min(480px, calc(100dvh - 160px))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-white" />
              <span className="text-sm font-semibold text-white">CashflowWise Copilot</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <ChevronDown size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="bg-indigo-50 rounded-xl px-4 py-3">
                  <p className="text-sm font-semibold text-indigo-900 mb-0.5">Hi! I'm your AI copilot 👋</p>
                  <p className="text-xs text-indigo-700">I know your properties, bills, income and cashflow. Ask me anything.</p>
                </div>
                <p className="text-xs text-slate-400 font-medium px-1">Try asking:</p>
                <div className="space-y-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-xs text-slate-700 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg px-3 py-2 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-slate-100 shrink-0">
            <div className="flex items-end gap-2 bg-slate-50 rounded-xl border border-slate-200 px-3 py-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about your cashflow…"
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 resize-none outline-none max-h-24"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="shrink-0 w-7 h-7 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg transition-colors"
              >
                <Send size={13} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">Powered by AI · Knows your live data</p>
          </div>
        </div>
      )}
    </>
  );
}
