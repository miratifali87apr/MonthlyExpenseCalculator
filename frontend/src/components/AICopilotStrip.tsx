'use client';

import { useRef, useState } from 'react';
import { Sparkles, Send, ChevronUp } from 'lucide-react';
import { chatApi } from '@/lib/api';

type Message = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Am I cashflow positive this month?',
  'What bills are overdue?',
  'Which property costs me most?',
];

export function AICopilotStrip() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setExpanded(true);

    const userMsg: Message = { role: 'user', content: msg };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const { reply } = await chatApi.send(msg, next.slice(0, -1));
      setMessages([...next, { role: 'assistant', content: reply }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch {
      setMessages([...next, { role: 'assistant', content: "Couldn't reach the server. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-violet-800/20 bg-gradient-to-br from-[#1e1040] via-[#1e1b4b] to-[#0f172a]">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-violet-500/20 flex items-center justify-center">
            <Sparkles size={11} className="text-violet-300" />
          </div>
          <span className="text-xs font-semibold text-violet-100">AI Copilot</span>
          <span className="text-[10px] text-violet-400 bg-violet-900/40 border border-violet-700/30 px-1.5 py-0.5 rounded-full">
            knows your live data
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-violet-400 hover:text-violet-200 transition-colors p-1"
          >
            <ChevronUp size={14} className={`transition-transform ${expanded ? '' : 'rotate-180'}`} />
          </button>
        )}
      </div>

      {/* Suggestion chips — only when no conversation yet */}
      {messages.length === 0 && (
        <div className="flex gap-2 px-4 pb-3 flex-wrap">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={loading}
              className="text-[11px] text-violet-300 bg-violet-900/30 hover:bg-violet-800/50 border border-violet-700/30 hover:border-violet-500/50 rounded-full px-3 py-1.5 transition-all disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Conversation — visible when expanded */}
      {expanded && messages.length > 0 && (
        <div className="px-4 pb-2 space-y-2.5 max-h-56 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] text-xs rounded-xl px-3 py-2 leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/8 text-violet-100 border border-violet-700/20'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/8 border border-violet-700/20 rounded-xl px-3 py-2 flex gap-1">
                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-1">
        <div className="flex items-center gap-2 bg-white/5 border border-violet-700/25 hover:border-violet-600/40 rounded-xl px-3 py-2.5 transition-colors">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(); }}
            placeholder="Ask anything about your cashflow…"
            className="flex-1 bg-transparent text-xs text-violet-100 placeholder-violet-500 outline-none"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-6 h-6 flex items-center justify-center bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900/60 disabled:cursor-not-allowed rounded-lg transition-colors shrink-0"
          >
            <Send size={11} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
