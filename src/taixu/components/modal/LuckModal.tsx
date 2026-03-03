import { klona } from 'klona';
import { Clock, HelpCircle, Hash, Scale, Settings2, Sparkles, Zap } from 'lucide-react';
import React, { useState } from 'react';
import toastr from 'toastr';
import { getRuntimeSchema } from '../../utils/schemaLoader';
import { useMvuData } from '../../hooks/useMvuData';

interface LuckModalProps {
  data: any;
  onAddCommand?: (name: string, prompt: string) => void;
  onUpdateMvuData?: (newData: any) => void;
}

const LuckModal: React.FC<LuckModalProps> = ({ data, onAddCommand, onUpdateMvuData }) => {
  const [mvuData, setMvuData] = useMvuData(getRuntimeSchema);
  const commandSet = data?.commandSet || [];
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [showDivination, setShowDivination] = useState(false);
  const [confirmTarget, setConfirmMark] = useState<{ mark: any, source: 'active' } | null>(null);
  const markApSpend = (amount: number) => {
    (window as any).taixujie_ap_token = { kind: 'spend', amount, ts: Date.now() };
  };

  // 检查某个印记是否已经在指令集中
  const isMarkInCommandSet = (markName: string) => {
    return commandSet.some((cmd: any) => cmd.prompt.includes(`使用天运印记「${markName}」`));
  };

  // 统一使用“洞天秘宝”作为唯一的奖池
  const currentPoolKey = '洞天秘宝';
  const poolConfig = mvuData.天运系统?.[currentPoolKey] || { 仙: 0, 天: 0, 地: 0, 玄: 0, 黄: 0, 凡: 0 };
  const activeMarks = mvuData.天运系统?.天运印记?.列表 || [];
  const currentAP = mvuData.系统信息?.当前行动点 || 0;
  const lotteryCount = mvuData.天运系统?.已抽奖次数 ?? 0;
  const syncMvuData = (newData: any) => {
    setMvuData(newData);
    onUpdateMvuData?.(newData);
  };

  /**
   * 触发天运卜算 - 现在仅切换界面，不再发送指令
   */
  const handleMarkToggle = () => {
    setShowDivination(prev => {
      const next = !prev;
      if (next) {
        setIsAdjusting(false);
      }
      return next;
    });
  };

  /**
   * 开启秘宝（仅消耗已使用的印记次数）
   */
  const handleOpenTreasure = () => {
    const newData = klona(mvuData);
    if (!newData.天运系统) newData.天运系统 = {};
    if (!newData.天运系统.天运印记) {
      newData.天运系统.天运印记 = { 刷新倒计时: '二时', 列表: [] };
    }
    if (!newData.天运系统.天运印记.列表) newData.天运系统.天运印记.列表 = [];

    let consumedCount = 0;
    newData.天运系统.天运印记.列表 = newData.天运系统.天运印记.列表
      .map((mark: any) => {
        if (mark.状态 === '已使用') {
          consumedCount++;
          return { ...mark, 剩余次数: (mark.剩余次数 || 0) - 1, 状态: '闲置' };
        }
        return mark;
      })
      .filter((mark: any) => mark.剩余次数 > 0);

    if (consumedCount === 0) {
      toastr.warning('当前没有生效中的印记，秘宝直接开启，未有因果损耗。');
    } else {
      toastr.info(`开启了洞天秘宝，${consumedCount} 个已激活的印记因果已损耗。`);
    }

    syncMvuData(newData);
  };

  /**
   * 执行确认逻辑：直接写入 MVU，印记即时生效，不发送指令
   */
  const executeApplyMark = () => {
    if (!confirmTarget) return;
    const { mark } = confirmTarget;
    const cost = mark.消耗行动点 || 0;
    if (currentAP < cost) {
      toastr.error('当前行动点不足，无法生效该印记。');
      return;
    }

    markApSpend(cost);
    const newData = klona(mvuData);
    if (!newData.天运系统) newData.天运系统 = {};
    if (!newData.天运系统.天运印记) {
      newData.天运系统.天运印记 = { 刷新倒计时: '二时', 列表: [] };
    }
    if (!newData.天运系统.天运印记.列表) newData.天运系统.天运印记.列表 = [];
    if (!newData.系统信息) newData.系统信息 = { 当前行动点: 0, 最大行动点: 0 };

    newData.天运系统.天运印记.列表 = newData.天运系统.天运印记.列表.map((item: any) => {
      if (item.名称 === mark.名称) return { ...item, 状态: '已使用' };
      return item;
    });
    newData.系统信息.当前行动点 = Math.max(0, (newData.系统信息.当前行动点 || 0) - cost);

    syncMvuData(newData);

    setConfirmMark(null);
    toastr.success(`天运印记【${mark.名称}】已生效，消耗 ${cost} 点行动点。`);
  };

  const tiers = [
    { key: '仙', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
    { key: '天', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    { key: '地', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    { key: '玄', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { key: '黄', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { key: '凡', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  ];

  const updateProbability = (key: string, newValue: number) => {
    const newData = klona(mvuData);
    if (!newData.天运系统) newData.天运系统 = {};
    if (!newData.天运系统[currentPoolKey]) {
      newData.天运系统[currentPoolKey] = { 仙: 0, 天: 0, 地: 0, 玄: 0, 黄: 0, 凡: 100 };
    }

    const pool = newData.天运系统[currentPoolKey];
    const oldValue = (pool[key] as number) || 0;
    newValue = Math.max(0, Math.min(100, newValue));
    const diff = newValue - oldValue;
    pool[key] = newValue;

    const otherKeys = Object.keys(pool).filter(k => k !== key);
    const otherSum = otherKeys.reduce((sum, k) => sum + ((pool[k] as number) || 0), 0);

    if (otherSum > 0) {
      otherKeys.forEach(k => {
        const currentVal = (pool[k] as number) || 0;
        const ratio = currentVal / otherSum;
        pool[k] = Math.max(0, currentVal - diff * ratio);
      });
    } else if (otherKeys.length > 0) {
      const remaining = 100 - newValue;
      otherKeys.forEach(k => {
        pool[k] = remaining / otherKeys.length;
      });
    }

    const finalSum = Object.values(pool).reduce((a, b) => (a as number) + (b as number), 0) as number;
    if (Math.abs(finalSum - 100) > 0.001) {
      const firstOtherKey = otherKeys[0];
      if (firstOtherKey) {
        (pool[firstOtherKey] as number) += (100 - finalSum);
      }
    }
    syncMvuData(newData);
  };

  return (
    <div className="flex flex-col h-full space-y-6 relative">
      {/* 确认弹窗 Overlay */}
      {confirmTarget && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-xs rounded-3xl animate-in fade-in duration-200">
          <div className="bg-white border-2 border-emerald-400 shadow-2xl rounded-2xl p-6 max-w-[280px] w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <HelpCircle className="w-6 h-6" />
              <h4 className="font-black text-lg">因果定夺</h4>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              是否决定动用印记<span className="text-emerald-600 font-bold mx-1">「{confirmTarget.mark.名称}」</span>？
              <span className="block mt-2 text-[10px] text-orange-500 font-bold italic">
                ※ 将消耗 {confirmTarget.mark.消耗行动点 || 0} 点行动点
              </span>
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmMark(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-400 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                罢休
              </button>
              <button
                onClick={executeApplyMark}
                className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-100 transition-all"
              >
                施为
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 顶部标题与倒计时 */}
      <div className="flex flex-col space-y-2 border-b border-emerald-100 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
            <h2 className="text-xl font-black text-slate-800 tracking-tight">天运系统</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkToggle}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-bold text-sm ${showDivination
                ? 'bg-amber-500 text-white border-amber-400 shadow-md'
                : 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100 hover:shadow-sm'
                }`}
            >
              <Sparkles className={`w-4 h-4 ${showDivination ? 'animate-pulse' : ''}`} />
              天运印记
            </button>
            <button
              onClick={() => setIsAdjusting(!isAdjusting)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-bold text-sm ${isAdjusting
                ? 'bg-emerald-500 text-white border-emerald-400 shadow-md'
                : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50'
                }`}
            >
              <Settings2 className={`w-4 h-4 ${isAdjusting ? 'animate-spin-slow' : ''}`} />
              运气控制
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg w-fit">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">已抽奖次数：</span>
            <span className="text-[10px] font-black text-amber-600">{lotteryCount}</span>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-h-[480px] bg-slate-50/50 rounded-2xl border-2 border-dashed border-emerald-100 p-6 flex flex-col relative">
        {/* 顶部已激活印记展示栏 */}
        {!showDivination && !isAdjusting && activeMarks.some((m: any) => m.状态 === '已使用') && (
          <div className="mb-6 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
            {activeMarks.filter((m: any) => m.状态 === '已使用').map((mark: any, idx: number) => (
              <div key={idx} className="group relative">
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] font-bold text-emerald-600 shadow-sm shadow-emerald-100/50">
                  <Sparkles className="w-3 h-3 text-emerald-500 animate-pulse" />
                  <span>{mark.名称}</span>
                  <span className="text-[8px] bg-emerald-200/50 px-1.5 py-0.5 rounded ml-1 font-black">生效中</span>
                </div>
                <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-800 text-white rounded-xl shadow-xl z-100 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-[10px] leading-relaxed mb-2 opacity-90 font-medium">{mark.效果}</p>
                  <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[9px] font-black uppercase tracking-wider text-emerald-400">
                    <span>剩余因果次数</span>
                    <span className="bg-emerald-500/20 px-1.5 py-0.5 rounded italic">{mark.剩余次数} 次</span>
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-slate-800"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col h-full space-y-6 relative z-10">
          {showDivination ? (
            // 窥视天机页面 - 仅承接变量中的闲置印记
            <div className="flex-1 flex flex-col items-center justify-start space-y-8 animate-in zoom-in-95 duration-300">
              <div className="text-center space-y-2 pt-4">
                <h3 className="text-2xl font-black text-slate-700 tracking-tighter">窥视天机</h3>
                <p className="text-xs text-slate-400 font-bold italic">“因果有定，印记无常。”</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg w-fit">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">因果更迭倒计时：</span>
                  <span className="text-[10px] font-black text-emerald-600">{mvuData.天运系统?.天运印记?.刷新倒计时 || '暂无数据'}</span>
                </div>
              </div>

              {/* 闲置印记展示区 (完全由 mvuData 驱动) */}
              <div className="w-full">
                {activeMarks.filter((m: any) => m.状态 === '闲置').length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                    {activeMarks.filter((m: any) => m.状态 === '闲置').map((mark: any, idx: number) => {
                      const isQueued = isMarkInCommandSet(mark.名称);
                      return (
                        <button
                          key={idx}
                          disabled={isQueued}
                          onClick={() => setConfirmMark({ mark, source: 'active' })}
                          className={`flex flex-col p-4 bg-white border-2 rounded-2xl shadow-sm transition-all group text-left relative overflow-hidden ${isQueued
                            ? 'border-amber-200 opacity-80 cursor-not-allowed'
                            : 'border-emerald-100 hover:shadow-xl hover:border-emerald-400 hover:scale-105'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className={`p-2 rounded-lg ${isQueued ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>
                              <Sparkles className={`w-5 h-5 ${!isQueued ? 'group-hover:rotate-12' : ''} transition-transform`} />
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-black uppercase text-orange-500">
                              <Zap className="w-3 h-3" />
                              {mark.消耗行动点 || 0} AP
                            </div>
                          </div>
                          <h4 className="font-black text-lg mb-1 text-slate-800">{mark.名称}</h4>
                          <p className="text-xs font-medium text-slate-500 mb-4 line-clamp-2 leading-relaxed">{mark.效果}</p>
                          <div className="flex items-center gap-1.5 mt-auto border-t border-slate-50 pt-3 text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold tracking-tight">可作用 {mark.剩余次数} 次</span>
                          </div>
                          {isQueued && (
                            <div className="absolute top-2 right-2 bg-amber-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black animate-pulse shadow-sm">
                              待发中
                            </div>
                          )}
                          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity text-emerald-500">
                            <Sparkles className="w-20 h-20" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-300 space-y-3">
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center">
                      <HelpCircle className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="text-sm font-serif italic">暂无闲置印记，点击右上方卜算以求天机</p>
                  </div>
                )}
              </div>

              <div className="mt-auto pb-4" />
            </div>
          ) : isAdjusting ? (
            // 运气控制页面
            <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-6">
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-500">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-700 text-sm">天道自动平衡系统已激活</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      拖动任意品阶，其他因果将自动互补，维持100%恒定
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {tiers.map(tier => (
                  <div key={tier.key} className={`${tier.bg} ${tier.border} border p-4 rounded-2xl space-y-3 shadow-sm transition-all hover:shadow-md`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-lg font-black ${tier.color}`}>{tier.key} · 阶</span>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-mono font-bold text-slate-600">
                          {parseFloat(((poolConfig[tier.key] as number) || 0).toFixed(2))}%
                        </span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.01"
                      value={(poolConfig[tier.key] as number) || 0}
                      onChange={(e) => updateProbability(tier.key, parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">手动修正</span>
                      <div className="relative flex-1 max-w-[80px]">
                        <input
                          type="number"
                          value={(poolConfig[tier.key] as number) || 0}
                          onChange={(e) => updateProbability(tier.key, parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-center focus:outline-emerald-400 font-bold text-slate-700"
                        />
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-300">%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // 抽奖主页面
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
              <div className="relative mt-4">
                <button
                  onClick={handleOpenTreasure}
                  className="w-32 h-32 rounded-full flex items-center justify-center mx-auto shadow-inner transition-all duration-700 bg-orange-100 shadow-orange-200 hover:scale-110 active:scale-95 group"
                >
                  <Sparkles className="w-16 h-16 text-orange-500 group-hover:rotate-12 transition-transform" />
                </button>
                <div className="space-y-2 mt-6">
                  <h3 className="text-2xl font-black text-slate-700 tracking-tight">洞天秘宝</h3>
                  <p className="text-slate-400 max-w-xs mx-auto text-sm italic font-serif">
                    点击图标消耗生效中印记并“开启”秘宝
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 w-full max-w-md mt-8">
                  {tiers.map(tier => (
                    <div key={tier.key} className={`px-4 py-3 rounded-2xl border ${tier.border} ${tier.bg} flex flex-col items-center gap-1 shadow-sm`}>
                      <span className={`text-sm font-black ${tier.color}`}>{tier.key}阶</span>
                      <span className="text-xs font-mono font-bold text-slate-600">
                        {parseFloat(((poolConfig[tier.key] as number) || 0).toFixed(2))}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LuckModal;
