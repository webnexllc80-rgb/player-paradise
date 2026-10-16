'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Headphones, Send, X, Shield, Sparkles } from 'lucide-react';

export default function LiveChatWidget({ user, soundEnabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Android Native Back Button Support for APK & Mobile Browser
  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ vegasChatOpen: true }, '');

      const handlePopState = (e) => {
        setIsOpen(false);
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isOpen]);

  const handleClose = () => {
    if (window.history.state?.vegasChatOpen) {
      window.history.back();
    } else {
      setIsOpen(false);
    }
  };

  // Mobile virtual keyboard handling via VisualViewport API
  useEffect(() => {
    if (!isOpen) {
      setKeyboardOffset(0);
      return;
    }

    const updateKeyboardOffset = () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        const offset = window.innerHeight - window.visualViewport.height;
        // If offset is significant, virtual keyboard is active
        setKeyboardOffset(offset > 80 ? offset : 0);
      }
    };

    window.visualViewport?.addEventListener('resize', updateKeyboardOffset);
    window.visualViewport?.addEventListener('scroll', updateKeyboardOffset);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboardOffset);
      window.visualViewport?.removeEventListener('scroll', updateKeyboardOffset);
    };
  }, [isOpen]);

  // Poll chat messages when open
  useEffect(() => {
    if (!isOpen) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch('/api/chat');
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages || []);
        }
      } catch {}
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3500);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, keyboardOffset]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || sending) return;

    const text = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
      }
    } catch {} finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating Headphone Support Button */}
      <div className="fixed bottom-6 right-5 sm:right-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-xl"
          style={{
            background: 'linear-gradient(135deg, #00F0FF 0%, #E026D8 100%)',
            boxShadow: '0 8px 30px rgba(0, 240, 255, 0.45), 0 0 15px rgba(224, 38, 216, 0.35)',
          }}
          aria-label="Open 24/7 Live Support"
        >
          <Headphones size={24} className="text-black" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#070514] animate-pulse" />
        </button>
      </div>

      {/* Chat Drawer / Modal with Mobile Keyboard Offset */}
      {isOpen && (
        <div
          className="fixed right-3 sm:right-6 w-[94vw] sm:w-[380px] max-h-[82vh] h-[520px] rounded-2xl flex flex-col z-50 overflow-hidden shadow-2xl transition-all duration-150"
          style={{
            backgroundColor: '#0B071A',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(0, 240, 255, 0.15)',
            bottom: keyboardOffset > 0 ? `${keyboardOffset + 12}px` : '88px',
          }}
        >
          {/* Header */}
          <div
            className="p-3.5 border-b flex items-center justify-between"
            style={{
              background: 'linear-gradient(135deg, #170E38 0%, #0D0722 100%)',
              borderColor: 'rgba(0, 240, 255, 0.2)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-black"
                  style={{ background: 'linear-gradient(135deg, #00F0FF 0%, #E026D8 100%)' }}
                >
                  PP
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0B071A]" />
              </div>
              <div>
                <h4 className="text-xs font-black text-white flex items-center gap-1.5" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  <span>Players Paradise Support</span>
                  <Sparkles size={12} color="#00F0FF" />
                </h4>
                <p className="text-[10.5px] text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>24/7 Priority Help Desk</span>
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
              aria-label="Close Chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Compliance Notice */}
          <div
            className="px-3 py-1.5 border-b flex items-center gap-2 text-[10px] text-gray-400"
            style={{ backgroundColor: '#070412', borderColor: 'rgba(255, 255, 255, 0.06)' }}
          >
            <Shield size={12} color="#00F0FF" className="shrink-0" />
            <span style={{ fontFamily: 'Lexend, sans-serif' }}>
              Encrypted 24/7 Financial &amp; Account Support
            </span>
          </div>

          {/* Messages Body */}
          <div
            className="flex-1 p-3.5 overflow-y-auto space-y-3"
            style={{ backgroundColor: '#0A0617' }}
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2">
                <Headphones size={36} color="#00F0FF" style={{ opacity: 0.6 }} />
                <p className="font-bold text-sm text-white" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  How can we help you today?
                </p>
                <p className="text-xs text-gray-400" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  Ask about deposits, bonus coins, game credentials, or cash withdrawals.
                </p>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isPlayer = m.senderRole === 'player';
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isPlayer ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                        isPlayer
                          ? 'text-black font-extrabold rounded-br-none shadow-md'
                          : 'text-white border border-white/10 rounded-bl-none font-medium'
                      }`}
                      style={{
                        background: isPlayer
                          ? 'linear-gradient(135deg, #00F0FF 0%, #00C2D1 100%)'
                          : '#170E38',
                        fontFamily: 'Lexend, sans-serif',
                      }}
                    >
                      {m.text}
                    </div>
                    <span className="text-[9.5px] text-gray-500 mt-1 px-1 font-mono">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Form */}
          <form
            onSubmit={handleSendMessage}
            className="p-2.5 border-t flex items-center gap-2"
            style={{ backgroundColor: '#0F0924', borderColor: 'rgba(0, 240, 255, 0.2)' }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={user ? "Type your message..." : "Sign in to chat with support..."}
              disabled={!user || sending}
              value={inputMessage}
              onFocus={() => {
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 300);
              }}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 py-2 px-3 text-xs rounded-xl text-white placeholder-gray-500 focus:outline-none transition"
              style={{
                backgroundColor: '#06030F',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                fontFamily: 'Lexend, sans-serif',
              }}
            />
            <button
              type="submit"
              disabled={!user || !inputMessage.trim() || sending}
              className="p-2.5 rounded-xl font-bold flex items-center justify-center transition disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #E026D8 0%, #00F0FF 100%)',
                color: '#FFFFFF',
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
