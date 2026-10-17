'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Headphones, Send, X, Shield, Sparkles, Paperclip, Image as ImageIcon, ExternalLink } from 'lucide-react';

export default function LiveChatWidget({ user: initialUser, soundEnabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(initialUser || null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [guestId, setGuestId] = useState('');
  const [selectedPreviewImage, setSelectedPreviewImage] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync or fetch current user if not provided via props
  useEffect(() => {
    if (initialUser) {
      setCurrentUser(initialUser);
    } else {
      fetch('/api/auth/me')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.user) setCurrentUser(d.user);
        })
        .catch(() => {});
    }
  }, [initialUser]);

  // Initialize or retrieve persistent guestId for unauthenticated visitors
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let storedId = localStorage.getItem('pp_guest_chat_id');
      if (!storedId) {
        storedId = `guest_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
        localStorage.setItem('pp_guest_chat_id', storedId);
      }
      setGuestId(storedId);
    }
  }, []);

  // Android Native Back Button Support for APK & Mobile Browser
  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ ppChatOpen: true }, '');

      const handlePopState = () => {
        setIsOpen(false);
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isOpen]);

  const handleClose = () => {
    if (window.history.state?.ppChatOpen) {
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

  // Poll chat messages when open (works for both logged in users AND guest visitors)
  useEffect(() => {
    if (!isOpen) return;

    const fetchMessages = async () => {
      try {
        const endpoint = currentUser ? '/api/chat' : `/api/chat?guestId=${guestId}`;
        const res = await fetch(endpoint);
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages || []);
        }
      } catch {}
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3500);
    return () => clearInterval(interval);
  }, [isOpen, currentUser, guestId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, keyboardOffset, attachedImage]);

  // Compress & read image to lightweight base64
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Scale to max 1200px width/height for fast transfer
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setAttachedImage(compressedDataUrl);
        setUploadingImage(false);
      };
      img.onerror = () => {
        setAttachedImage(event.target.result);
        setUploadingImage(false);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !attachedImage) || sending) return;

    const text = inputMessage.trim();
    const imagePayload = attachedImage;
    setInputMessage('');
    setAttachedImage(null);
    setSending(true);

    try {
      const payload = currentUser
        ? { text, imageUrl: imagePayload }
        : {
            text,
            imageUrl: imagePayload,
            guestId,
            guestName: `Guest #${guestId.slice(-4).toUpperCase()}`,
          };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
    } catch {
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating Headphone Support Button - Visible site-wide */}
      <div className="fixed bottom-6 right-5 sm:right-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-xl cursor-pointer"
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

      {/* Lightbox Image Preview Modal */}
      {selectedPreviewImage && (
        <div
          onClick={() => setSelectedPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[85vh] p-2">
            <button
              onClick={() => setSelectedPreviewImage(null)}
              className="absolute -top-10 right-0 p-2 text-white bg-slate-800 rounded-full hover:bg-slate-700"
            >
              <X size={20} />
            </button>
            <img
              src={selectedPreviewImage}
              alt="Enlarged attachment"
              className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl border border-[var(--neon-cyan)]/40"
            />
          </div>
        </div>
      )}

      {/* Chat Drawer / Modal with Mobile Keyboard Offset */}
      {isOpen && (
        <div
          className="fixed right-3 sm:right-6 w-[94vw] sm:w-[390px] max-h-[84vh] h-[550px] rounded-2xl flex flex-col z-50 overflow-hidden shadow-2xl transition-all duration-150"
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
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>24/7 Desk Online</span>
                  </span>
                  {!currentUser && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Guest Mode
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Close Chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Compliance & Mode Notice */}
          <div
            className="px-3 py-1.5 border-b flex items-center justify-between text-[10px] text-gray-400"
            style={{ backgroundColor: '#070412', borderColor: 'rgba(255, 255, 255, 0.06)' }}
          >
            <div className="flex items-center gap-1.5">
              <Shield size={11} color="#00F0FF" className="shrink-0" />
              <span>Encrypted 24/7 Live Support & Attachments</span>
            </div>
            {!currentUser ? (
              <span className="text-amber-400/90 font-mono text-[9.5px]">Guest Access</span>
            ) : (
              <span className="text-emerald-400/90 font-mono text-[9.5px]">@{currentUser.username}</span>
            )}
          </div>

          {/* Messages Body */}
          <div
            className="flex-1 p-3.5 overflow-y-auto space-y-3"
            style={{ backgroundColor: '#0A0617' }}
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30 flex items-center justify-center">
                  <Headphones size={24} className="text-[var(--neon-cyan)]" />
                </div>
                <div>
                  <p className="font-bold text-sm text-white" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    Welcome to 24/7 Live Support!
                  </p>
                  <p className="text-xs text-slate-400 mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {!currentUser
                      ? 'Chatting as a guest! Send messages or upload payment/game screenshots anytime.'
                      : 'Ask about game credentials, cashout speed, or attach verification screenshots.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10.5px] text-slate-300">
                    ⚡ Typical reply in &lt; 1 min
                  </span>
                </div>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isPlayer = m.senderRole === 'player';
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isPlayer ? 'items-end' : 'items-start'}`}
                  >
                    <div className="text-[9.5px] text-slate-400 mb-0.5 px-1 font-mono">
                      {isPlayer ? (m.username || 'You') : 'Desk Support'}
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                        isPlayer
                          ? 'text-black font-semibold rounded-br-none shadow-md'
                          : 'text-white border border-white/10 rounded-bl-none font-medium'
                      }`}
                      style={{
                        background: isPlayer
                          ? 'linear-gradient(135deg, #00F0FF 0%, #00C2D1 100%)'
                          : '#170E38',
                        fontFamily: 'Lexend, sans-serif',
                      }}
                    >
                      {/* Attached image if present */}
                      {m.imageUrl && (
                        <div className="mb-1.5 overflow-hidden rounded-xl">
                          <img
                            src={m.imageUrl}
                            alt="Attachment"
                            onClick={() => setSelectedPreviewImage(m.imageUrl)}
                            className="max-h-56 max-w-full rounded-xl object-cover cursor-pointer hover:opacity-95 transition-transform active:scale-98 border border-black/20"
                          />
                        </div>
                      )}
                      {m.text && <p className="break-words">{m.text}</p>}
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

          {/* Pending Image Attachment Preview */}
          {attachedImage && (
            <div className="px-3 py-2 bg-[#0c0820] border-t border-[var(--neon-cyan)]/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={attachedImage}
                  alt="Attachment preview"
                  className="w-10 h-10 rounded-lg object-cover border border-[var(--neon-cyan)] shrink-0"
                />
                <span className="text-[11px] text-slate-300 truncate font-mono">
                  Image attached (ready to send)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 transition"
                title="Remove attachment"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Message Input Form */}
          <form
            onSubmit={handleSendMessage}
            className="p-2.5 border-t flex items-center gap-2"
            style={{ backgroundColor: '#0F0924', borderColor: 'rgba(0, 240, 255, 0.2)' }}
          >
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage || sending}
              className="p-2 rounded-xl text-slate-300 hover:text-[var(--neon-cyan)] bg-white/5 hover:bg-white/10 transition shrink-0"
              title="Attach screenshot or photo"
            >
              {uploadingImage ? (
                <span className="w-4 h-4 rounded-full border-2 border-t-[var(--neon-cyan)] border-slate-600 animate-spin inline-block" />
              ) : (
                <Paperclip size={16} />
              )}
            </button>

            <input
              ref={inputRef}
              type="text"
              placeholder={
                currentUser ? 'Type message or attach image...' : 'Type as guest (no login needed)...'
              }
              disabled={sending}
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
              disabled={(!inputMessage.trim() && !attachedImage) || sending}
              className="p-2.5 rounded-xl font-bold flex items-center justify-center transition disabled:opacity-40 cursor-pointer shrink-0"
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
