import React from 'react';
import { GridBar, ProgressBar } from '../UIElements';

interface Props {
  state: any;
}

const SystemStatus: React.FC<Props> = ({ state }) => {
  // @ts-ignore
  const userName = substitudeMacros('{{user}}');

  return (
    <>
      <section className="mb-8 mt-4">
        <h3 className="text-emerald-800 font-bold mb-4 border-b border-emerald-200 pb-2">
          仙玉录 ({userName})
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-800">仙玉录等级</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">Lv.{state.等级}</span>
          </div>
          <ProgressBar label="经验值" current={state.$当前经验 ?? state.经验值} max={1000} colorClass="bg-emerald-500" />
          <div className="flex justify-between mt-2">
            <span className="font-bold text-slate-800">仙缘</span>
            <span className="font-bold text-amber-600 flex items-center gap-1">{state.仙缘}</span>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <GridBar label="当前行动点数 (AP)" current={state.当前行动点} max={state.最大行动点} />
      </section>
    </>
  );
};

export default SystemStatus;
