'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  ShieldCheck,
  Bot,
  User,
  Clock
} from 'lucide-react';

export default function LiveChatWidget({ user, isOpen, onToggle }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchMessages = async () => {
    try {
      const email = user?.email || 'guest@playersparadisehub.com';
      const res = await fetch(`/api/chat?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.success && data.messages) {
        setMessages(data.messages);
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend) => {
    const msg = textToSend || inputText;
    if (!msg.trim()) return;

    setSending(true);
    setInputText('');

    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: msg,
          receiverEmail: 'support@playersparadisehub.com',
        }),
      });
      fetchMessages();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const suggestions = [
    'How do I deposit via Cash App?',
    'I need an Ultra Panda ID',
    'How do instant cashouts work?',
    'Where is the daily free bonus?',
  ];

  return (
    <>
      {/* Floating launcher button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-20 lg:bottom-6 right-5 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-[var(--neon-cyan)] to-blue-600 text-black font-heading font-black text-xs shadow-[0_0_25px_rgba(0,240,255,0.5)] hover:scale-105 active:scale-95 transition-all"
        >
          <div className="relative">
            <MessageSquare size={18} />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <span>24/7 LIVE SUPPORT</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 w-[92vw] sm:w-96 h-[500px] rounded-3xl border border-[var(--chrome-border)] bg-[var(--bg-deep)]/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/40 flex items-center justify-center font-bold">
                <Bot size={18} />
              </div>
              <div>
                <h3 className="font-heading font-bold text-xs text-white">
                  PARADISE VIP SUPPORT
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>ONLINE • INSTANT RESPONSE</span>
                </div>
              </div>
            </div>

            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <Bot size={28} className="mx-auto text-[var(--neon-cyan)] opacity-70" />
                <p className="text-xs text-slate-300">
                  Welcome to Players Paradise Hub! How can our VIP concierge assist you today?
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.isStaff ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[82%] p-3 rounded-2xl text-xs leading-relaxed ${
                      m.isStaff
                        ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-sm'
                        : 'bg-gradient-to-r from-[var(--neon-cyan)] to-blue-500 text-black font-semibold rounded-br-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 font-mono">
                    {m.sender}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions Chips */}
          <div className="p-2 border-t border-slate-800/80 bg-slate-950/60 overflow-x-auto flex gap-1.5 no-scrollbar">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s)}
                className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Type your message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-[var(--neon-cyan)]"
            />
            <button
              type="submit"
              disabled={sending || !inputText.trim()}
              className="p-2 rounded-xl bg-[var(--neon-cyan)] text-black font-bold disabled:opacity-40 transition-opacity"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
