'use client';

import React, { useState } from 'react';
import {
  Gamepad2,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';

export default function GamesLibraryTab({
  games = [],
  onUpdateGameUrl,
}) {
  const [urlInputs, setUrlInputs] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [saveSuccessId, setSaveSuccessId] = useState(null);

  const defaultPlatforms = [
    { id: 'ultra-panda', title: 'Ultra Panda', category: 'fish-slots', playUrl: 'https://www.ultrapanda.mobi', isInternal: false, active: true },
    { id: 'fire-kirin', title: 'Fire Kirin', category: 'fish-slots', playUrl: 'http://firekirin.xyz:8580', isInternal: false, active: true },
    { id: 'orion-stars', title: 'Orion Stars', category: 'fish-slots', playUrl: 'http://orionstars.vip:8580', isInternal: false, active: true },
    { id: 'game-vault', title: 'Game Vault', category: 'slots', playUrl: 'https://download.gamevault999.com', isInternal: false, active: true },
    { id: 'milky-way', title: 'Milky Way', category: 'fish-slots', playUrl: 'https://milkywayapp.xyz', isInternal: false, active: true },
    { id: 'juwa', title: 'Juwa 777', category: 'fish-slots', playUrl: 'https://m.juwa777.com', isInternal: false, active: true },
    { id: 'panda-slots', title: 'Panda 777 Slots', category: 'inhouse', playUrl: '#inhouse-slots', isInternal: true, active: true },
    { id: 'cyber-crash', title: 'Cyber Matrix Crash', category: 'inhouse', playUrl: '#inhouse-crash', isInternal: true, active: true },
  ];

  const displayGames = games.length > 0 ? games : defaultPlatforms;

  const handleSave = async (id, currentUrl) => {
    const newUrl = urlInputs[id] !== undefined ? urlInputs[id] : currentUrl;
    setSavingId(id);
    try {
      await onUpdateGameUrl?.(id, newUrl);
      setSaveSuccessId(id);
      setTimeout(() => setSaveSuccessId(null), 2500);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="p-4 rounded-2xl bg-[#090d22]/90 border border-cyan-500/20 backdrop-blur-xl">
        <h2 className="font-heading font-black text-sm md:text-base text-white tracking-wider flex items-center gap-2">
          <Gamepad2 size={18} className="text-cyan-400" /> GAME PLATFORMS & LAUNCH URL DIRECTORY
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage platform launch links, WebGL redirects, and in-house game access credentials for players.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayGames.map((game) => {
          const gameId = game.id || game._id;
          const currentUrl = urlInputs[gameId] !== undefined ? urlInputs[gameId] : game.playUrl || '';
          const isSaving = savingId === gameId;
          const isSaved = saveSuccessId === gameId;

          return (
            <div
              key={gameId}
              className="p-5 rounded-2xl bg-[#090d22]/90 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Gamepad2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-sm text-white">{game.title}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-cyan-400 font-mono uppercase bg-cyan-950 px-2 py-0.2 rounded">
                        {game.category}
                      </span>
                      {game.isInternal && (
                        <span className="text-[10px] text-amber-400 font-mono uppercase bg-amber-950 px-2 py-0.2 rounded">
                          In-House
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                  ACTIVE
                </div>
              </div>

              {/* URL Editor */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <LinkIcon size={12} className="text-cyan-400" /> Platform Launch Web URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={currentUrl}
                    onChange={(e) => setUrlInputs({ ...urlInputs, [gameId]: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 bg-slate-950/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                  />
                  <button
                    onClick={() => handleSave(gameId, game.playUrl)}
                    disabled={isSaving}
                    className="py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isSaved ? <CheckCircle2 size={13} className="text-emerald-900" /> : <Save size={13} />}
                    <span>{isSaved ? 'SAVED' : 'SAVE'}</span>
                  </button>
                </div>
              </div>

              {/* Footer preview */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
                <span>RTP: {game.rtp || 98.2}%</span>
                {currentUrl && !game.isInternal && (
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
                  >
                    <span>Test Launch</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
