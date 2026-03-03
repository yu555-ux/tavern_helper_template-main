import { ChevronUp, Eye, ScrollText, Send, Trash2, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface BottomInputAreaProps {
  options: Array<{ id: string; text: string }>;
  inputValue: string;
  isGenerating: boolean;
  commandSet: Array<{ name: string; prompt: string }>;
  onInputChange: (value: string) => void;
  onSend: (text?: string) => void;
  onRemoveCommand?: (index: number) => void;
  onOpenStatusEffects?: () => void;
}

const BottomInputArea: React.FC<BottomInputAreaProps> = ({
  options,
  inputValue,
  isGenerating,
  commandSet,
  onInputChange,
  onSend,
  onRemoveCommand,
  onOpenStatusEffects,
}) => {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [statusPos, setStatusPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
      return { x: -10, y: 118 };
    }
    return { x: -52, y: 78 };
  });
  const commandContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ dragging: boolean; moved: boolean }>({ dragging: false, moved: false });
  const dragPendingRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; baseX: number; baseY: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (commandContainerRef.current && !commandContainerRef.current.contains(event.target as Node)) {
        setCommandsOpen(false);
      }
    };

    if (commandsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [commandsOpen]);

  const handleSend = (text?: string) => {
    setOptionsOpen(false);
    onSend(text);
  };

  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  const dragMultiplier = isMobile ? 3 : 1;

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const handleStatusPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragStateRef.current.dragging = true;
    dragStateRef.current.moved = false;
    dragStartRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      baseX: statusPos.x,
      baseY: statusPos.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleStatusPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStateRef.current.dragging) return;
    if (Math.abs(event.movementX) > 0 || Math.abs(event.movementY) > 0) {
      dragStateRef.current.moved = true;
    }
    const start = dragStartRef.current;
    if (!start) return;
    const dx = (event.clientX - start.clientX) * dragMultiplier;
    const dy = (event.clientY - start.clientY) * dragMultiplier;
    dragPendingRef.current = {
      x: start.baseX + dx,
      y: start.baseY - dy
    };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        const pending = dragPendingRef.current;
        if (pending) {
          setStatusPos({ x: pending.x, y: pending.y });
          dragPendingRef.current = null;
        }
        rafRef.current = null;
      });
    }
  };

  const handleStatusPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStateRef.current.dragging) return;
    dragStateRef.current.dragging = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragPendingRef.current = null;
    dragStartRef.current = null;
  };

  return (
    <div className="relative flex flex-col items-center pointer-events-none z-50 px-3 sm:px-4 md:px-6 pb-0 sm:pb-1 md:pb-2 mt-auto">
      <div className="max-w-[92vw] sm:max-w-[36rem] lg:max-w-2xl w-full flex flex-col pointer-events-auto relative">
        {/* Input Box Section - 玉白主体 + 无缝圆角衔接 */}
        <div className="w-full flex flex-col pointer-events-none">
          {/* 可拖动状态按钮（默认在输入框上方） */}
          <button
            onClick={() => {
              if (!dragStateRef.current.moved) {
                onOpenStatusEffects?.();
              }
            }}
            onPointerDown={handleStatusPointerDown}
            onPointerMove={handleStatusPointerMove}
            onPointerUp={handleStatusPointerUp}
            className="absolute z-30 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white border border-slate-800/70 shadow-sm text-slate-600 hover:text-emerald-600 transition-colors duration-200 pointer-events-auto"
            style={{ left: `${statusPos.x}px`, bottom: `${statusPos.y}px` }}
            title="查看状态与效果"
          >
            <Eye className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          {/* Options Section - 横跨状态与输入框 */}
          {options.length > 0 && (
            <div className="w-full flex flex-col z-10 pointer-events-auto">
              {/* 方形 Toggle Button - 横跨全宽 */}
              <button
                onClick={() => setOptionsOpen(!optionsOpen)}
                className="w-full h-9 sm:h-10 bg-slate-50 flex items-center justify-center gap-2 text-slate-800 hover:text-slate-950 transition-colors border border-slate-800/70 border-b-0 rounded-t-xl rounded-b-none shadow-sm relative overflow-hidden"
              >
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase relative z-10">命运抉择</span>
                <div className={`transition-transform duration-300 relative z-10 ${optionsOpen ? 'rotate-180' : ''}`}>
                  <ChevronUp className="w-4 h-4" />
                </div>
              </button>

              {/* Options List - 全宽方形面板 */}
              <div
                className={`bg-slate-50 transition-all duration-500 ease-in-out overflow-hidden ${optionsOpen ? 'max-h-72 opacity-100 pointer-events-auto' : 'max-h-0 opacity-0 pointer-events-none'
                  } border-x border-t border-slate-800/70 shadow-sm flex flex-col`}
              >
                <div className="p-4 space-y-2.5 overflow-y-auto custom-scrollbar flex-1">
                  {options.map((opt, index) => (
                    <button
                      key={opt.id}
                      onClick={() => handleSend(opt.text)}
                      className="w-full text-left px-6 py-4 bg-white/60 hover:bg-linear-to-br hover:from-slate-700 hover:to-slate-900 rounded-lg border border-slate-800/80 transition-all duration-300 group shadow-sm hover:shadow-[0_0_20px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 animate-[slideIn_0.4s_ease-out] relative overflow-hidden"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                      <span className="text-sm text-slate-800 group-hover:text-white font-medium leading-tight relative z-10">
                        {opt.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="w-full pointer-events-none">
            <div className="flex items-stretch gap-0 pointer-events-auto bg-white border-x border-t border-b border-slate-800/70 shadow-sm rounded-b-xl rounded-t-none overflow-hidden">
              <div className="flex-1 relative group/input z-20 flex flex-col">
                {/* 玉白主体 - 动态衔接圆角 */}
                <div className="relative flex flex-col bg-white p-1 transition-all duration-300 rounded-b-xl rounded-t-none">
                  {/* 待发送指令集预览 */}
                  {commandSet.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-4 pt-2 pb-1 border-b border-emerald-100/50 mb-1 animate-in fade-in slide-in-from-top-1">
                      {commandSet.map((cmd, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-200/50 text-emerald-800 rounded-lg group/chip">
                          <ScrollText className="w-3 h-3 opacity-50" />
                          <span className="text-[10px] font-black uppercase tracking-tight">{cmd.name}</span>
                          <button
                            onClick={() => onRemoveCommand?.(idx)}
                            className="p-0.5 hover:bg-rose-100 hover:text-rose-600 rounded-md transition-all text-xs leading-none"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          if (onRemoveCommand) {
                            for (let i = commandSet.length - 1; i >= 0; i--) onRemoveCommand(i);
                          }
                        }}
                        className="text-[10px] font-bold text-slate-400 hover:text-rose-500 px-2 py-1 transition-colors"
                      >
                        清空全部
                      </button>
                    </div>
                  )}

                  <div className="flex items-center w-full min-h-[50px] sm:min-h-[54px]">
                    {/* 指令集按钮 */}
                    <div className="relative" ref={commandContainerRef}>
                      <button
                        onClick={() => setCommandsOpen(!commandsOpen)}
                        className={`ml-2 p-2.5 sm:p-3 rounded-lg transition-all duration-300 ${commandsOpen ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'hover:bg-emerald-50 text-emerald-700'}`}
                      >
                        <ScrollText className="w-4 h-4 sm:w-5 sm:h-5" />
                        {commandSet.length > 0 && (
                          <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full border border-white font-bold">
                            {commandSet.length}
                          </span>
                        )}
                      </button>

                      {commandsOpen && (
                        <div className="absolute bottom-full left-0 mb-4 w-64 bg-white/95 backdrop-blur-xl border border-emerald-100 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="flex justify-between items-center mb-3 border-b border-emerald-50 pb-2">
                            <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">指令集</span>
                            <span className="text-[10px] text-slate-400 font-medium italic">{commandSet.length} 个就绪</span>
                          </div>
                          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                            {commandSet.length === 0 ? (
                              <div className="py-8 text-center text-sm text-slate-300 font-serif tracking-widest animate-pulse">无</div>
                            ) : (
                              commandSet.map((cmd, idx) => (
                                <div key={idx} className="group relative">
                                  <button
                                    onClick={() => {
                                      onInputChange(inputValue ? `${inputValue}\n${cmd.prompt}` : cmd.prompt);
                                      setCommandsOpen(false);
                                    }}
                                    className="w-full text-left p-3 bg-emerald-50/30 hover:bg-emerald-50 border border-emerald-100/50 rounded-xl transition-all"
                                  >
                                    <div className="text-xs font-bold text-emerald-900">{cmd.name}</div>
                                    <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{cmd.prompt}</div>
                                  </button>
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onRemoveCommand?.(idx);
                                    }}
                                    className="absolute top-2 right-2 p-1.5 bg-white/80 text-slate-400 hover:text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 内层暗影 */}
                    <div className="absolute inset-0 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.05)] pointer-events-none"></div>

                    <textarea
                      value={inputValue}
                      onChange={event => onInputChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          handleSend(undefined);
                        }
                      }}
                      placeholder="在此书写你的命决..."
                      className="flex-1 bg-transparent border-none px-4 sm:px-5 py-2 sm:py-2.5 focus:outline-none text-slate-800 placeholder:text-slate-400 resize-none font-serif text-base sm:text-lg leading-relaxed relative z-10"
                      rows={1}
                    />
                    <button
                      onClick={() => handleSend(undefined)}
                      disabled={isGenerating}
                      className={`mr-2 p-2.5 sm:p-3 bg-slate-800 text-white rounded-lg shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300 active:scale-90 group relative z-10 overflow-hidden ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-[shimmer_2s_ease-in-out_infinite]"></div>
                      {isGenerating ? (
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <Send className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomInputArea;
