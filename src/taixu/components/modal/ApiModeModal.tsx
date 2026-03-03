import React, { useState } from 'react';
import toastr from 'toastr';

interface ApiModeModalProps {
  multiApiEnabled: boolean;
  onToggleMultiApi: (val: boolean) => void;
  multiApiConfig: {
    apiurl: string;
    key: string;
    model: string;
    retries: number;
  };
  onUpdateMultiApiConfig: (config: any) => void;
  shopApiConfig: {
    apiurl: string;
    key: string;
    model: string;
    retries: number;
  };
  onUpdateShopApiConfig: (config: any) => void;
}

const ApiModeModal: React.FC<ApiModeModalProps> = ({
  multiApiEnabled,
  onToggleMultiApi,
  multiApiConfig,
  onUpdateMultiApiConfig,
  shopApiConfig,
  onUpdateShopApiConfig
}) => {
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [outputStatus, setOutputStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [outputMessage, setOutputMessage] = useState('');
  const [isTestingShopApi, setIsTestingShopApi] = useState(false);
  const [isFetchingShopModels, setIsFetchingShopModels] = useState(false);
  const [shopModelOptions, setShopModelOptions] = useState<string[]>([]);
  const [shopConnectionStatus, setShopConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [shopConnectionMessage, setShopConnectionMessage] = useState('');
  const [shopOutputStatus, setShopOutputStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [shopOutputMessage, setShopOutputMessage] = useState('');
  const hasModelList = typeof getModelList === 'function';

  const normalizeApiUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/\/v1\/?$/.test(trimmed)) return trimmed.replace(/\/$/, '');
    return `${trimmed.replace(/\/$/, '')}/v1`;
  };

  const updateMultiApi = (patch: Partial<ApiModeModalProps['multiApiConfig']>) => {
    onUpdateMultiApiConfig({ ...multiApiConfig, ...patch });
  };
  const updateShopApi = (patch: Partial<ApiModeModalProps['shopApiConfig']>) => {
    onUpdateShopApiConfig({ ...shopApiConfig, ...patch });
  };
  const handleTestConnection = async () => {
    const normalizedUrl = normalizeApiUrl(multiApiConfig.apiurl || '');
    if (!normalizedUrl) {
      toastr.warning('请先填写 API URL');
      return;
    }
    setIsTestingApi(true);
    setConnectionStatus('idle');
    setConnectionMessage('测试中...');
    try {
      if (normalizedUrl !== multiApiConfig.apiurl.trim()) {
        updateMultiApi({ apiurl: normalizedUrl });
      }
      await generateRaw({
        user_input: 'ping',
        ordered_prompts: ['user_input'],
        custom_api: {
          apiurl: normalizedUrl,
          key: multiApiConfig.key?.trim(),
          model: multiApiConfig.model || 'gpt-4o-mini',
          source: 'openai'
        }
      });
      setConnectionStatus('success');
      setConnectionMessage('连接正常');
      toastr.success('连接测试成功');
    } catch (e: any) {
      setConnectionStatus('error');
      setConnectionMessage(e.message || '未知错误');
      toastr.error(`连接测试失败: ${e.message || '未知错误'}`);
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleTestOutput = async () => {
    const normalizedUrl = normalizeApiUrl(multiApiConfig.apiurl || '');
    if (!normalizedUrl) {
      toastr.warning('请先填写 API URL');
      return;
    }
    setOutputStatus('idle');
    setOutputMessage('测试中...');
    try {
      if (normalizedUrl !== multiApiConfig.apiurl.trim()) {
        updateMultiApi({ apiurl: normalizedUrl });
      }
      await generateRaw({
        user_input: '请输出“测试通过”四个字，不要输出其他内容。',
        ordered_prompts: ['user_input'],
        custom_api: {
          apiurl: normalizedUrl,
          key: multiApiConfig.key?.trim(),
          model: multiApiConfig.model || 'gpt-4o-mini',
          source: 'openai'
        }
      });
      setOutputStatus('success');
      setOutputMessage('测试输出成功');
      toastr.success('测试输出成功');
    } catch (e: any) {
      setOutputStatus('error');
      setOutputMessage(e.message || '未知错误');
      toastr.error(`测试输出失败: ${e.message || '未知错误'}`);
    }
  };

  const handleFetchModels = async () => {
    const normalizedUrl = normalizeApiUrl(multiApiConfig.apiurl || '');
    if (!normalizedUrl) {
      toastr.warning('请先填写 API URL');
      return;
    }
    setIsFetchingModels(true);
    try {
      let list: string[] = [];
      if (hasModelList) {
        list = await getModelList({ apiurl: normalizedUrl, key: multiApiConfig.key?.trim() });
      } else {
        const headers: Record<string, string> = {};
        const key = multiApiConfig.key?.trim();
        if (key) headers.Authorization = `Bearer ${key}`;
        const resp = await fetch(`${normalizedUrl.replace(/\/$/, '')}/models`, { headers });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (Array.isArray(data?.data)) {
          list = data.data.map((item: any) => item?.id).filter(Boolean);
        } else if (Array.isArray(data?.models)) {
          list = data.models.map((item: any) => item?.id || item?.name).filter(Boolean);
        } else if (Array.isArray(data)) {
          list = data.map((item: any) => item?.id || item?.name || item).filter(Boolean);
        } else {
          throw new Error('未知的模型列表返回格式');
        }
      }
      setModelOptions(list || []);
      if (normalizedUrl !== multiApiConfig.apiurl.trim()) {
        updateMultiApi({ apiurl: normalizedUrl });
      }
      toastr.success('模型列表已获取');
    } catch (e: any) {
      toastr.error(`获取模型失败: ${e.message || '未知错误'}`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestShopConnection = async () => {
    const normalizedUrl = normalizeApiUrl(shopApiConfig.apiurl || '');
    if (!normalizedUrl) {
      toastr.warning('请先填写 API URL');
      return;
    }
    setIsTestingShopApi(true);
    setShopConnectionStatus('idle');
    setShopConnectionMessage('测试中...');
    try {
      if (normalizedUrl !== shopApiConfig.apiurl.trim()) {
        updateShopApi({ apiurl: normalizedUrl });
      }
      await generateRaw({
        user_input: 'ping',
        ordered_prompts: ['user_input'],
        custom_api: {
          apiurl: normalizedUrl,
          key: shopApiConfig.key?.trim(),
          model: shopApiConfig.model || 'gpt-4o-mini',
          source: 'openai'
        }
      });
      setShopConnectionStatus('success');
      setShopConnectionMessage('连接正常');
      toastr.success('连接测试成功');
    } catch (e: any) {
      setShopConnectionStatus('error');
      setShopConnectionMessage(e.message || '未知错误');
      toastr.error(`连接测试失败: ${e.message || '未知错误'}`);
    } finally {
      setIsTestingShopApi(false);
    }
  };

  const handleTestShopOutput = async () => {
    const normalizedUrl = normalizeApiUrl(shopApiConfig.apiurl || '');
    if (!normalizedUrl) {
      toastr.warning('请先填写 API URL');
      return;
    }
    setShopOutputStatus('idle');
    setShopOutputMessage('测试中...');
    try {
      if (normalizedUrl !== shopApiConfig.apiurl.trim()) {
        updateShopApi({ apiurl: normalizedUrl });
      }
      await generateRaw({
        user_input: '请输出“测试通过”四个字，不要输出其他内容。',
        ordered_prompts: ['user_input'],
        custom_api: {
          apiurl: normalizedUrl,
          key: shopApiConfig.key?.trim(),
          model: shopApiConfig.model || 'gpt-4o-mini',
          source: 'openai'
        }
      });
      setShopOutputStatus('success');
      setShopOutputMessage('测试输出成功');
      toastr.success('测试输出成功');
    } catch (e: any) {
      setShopOutputStatus('error');
      setShopOutputMessage(e.message || '未知错误');
      toastr.error(`测试输出失败: ${e.message || '未知错误'}`);
    }
  };

  const handleFetchShopModels = async () => {
    const normalizedUrl = normalizeApiUrl(shopApiConfig.apiurl || '');
    if (!normalizedUrl) {
      toastr.warning('请先填写 API URL');
      return;
    }
    setIsFetchingShopModels(true);
    try {
      let list: string[] = [];
      if (hasModelList) {
        list = await getModelList({ apiurl: normalizedUrl, key: shopApiConfig.key?.trim() });
      } else {
        const headers: Record<string, string> = {};
        const key = shopApiConfig.key?.trim();
        if (key) headers.Authorization = `Bearer ${key}`;
        const resp = await fetch(`${normalizedUrl.replace(/\/$/, '')}/models`, { headers });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (Array.isArray(data?.data)) {
          list = data.data.map((item: any) => item?.id).filter(Boolean);
        } else if (Array.isArray(data?.models)) {
          list = data.models.map((item: any) => item?.id || item?.name).filter(Boolean);
        } else if (Array.isArray(data)) {
          list = data.map((item: any) => item?.id || item?.name || item).filter(Boolean);
        } else {
          throw new Error('未知的模型列表返回格式');
        }
      }
      setShopModelOptions(list || []);
      if (normalizedUrl !== shopApiConfig.apiurl.trim()) {
        updateShopApi({ apiurl: normalizedUrl });
      }
      toastr.success('模型列表已获取');
    } catch (e: any) {
      toastr.error(`获取模型失败: ${e.message || '未知错误'}`);
    } finally {
      setIsFetchingShopModels(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
        <div className="space-y-3">
          <div className="p-4 bg-white/40 border border-emerald-100 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm text-slate-800 font-bold">API模式</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-tighter">
                  {multiApiEnabled ? '主API正文+历史，第二API仅更新变量' : '单API完整输出'}
                </span>
              </div>
              <div className="flex bg-emerald-50/50 p-1 rounded-full border border-emerald-100">
                <button
                  onClick={() => onToggleMultiApi(true)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                    multiApiEnabled ? 'bg-emerald-500 text-white shadow-sm' : 'text-emerald-300 hover:text-emerald-500'
                  }`}
                  title="开启多API模式"
                >
                  多
                </button>
                <button
                  onClick={() => onToggleMultiApi(false)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                    !multiApiEnabled ? 'bg-slate-500 text-white shadow-sm' : 'text-slate-300 hover:text-slate-500'
                  }`}
                  title="关闭多API模式"
                >
                  单
                </button>
              </div>
            </div>
            <div className="p-3 rounded-xl border border-emerald-100 bg-white/60 text-[10px] text-slate-500">
              变量更新 API 使用独立配置（不跟随酒馆当前 API）
            </div>
          </div>

          {multiApiEnabled && (
            <div className="space-y-3">
              <div className="p-4 bg-white/40 border border-emerald-100 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  变量更新 API 配置
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">API URL（OpenAI兼容）</label>
                    <input
                      className="w-full px-2.5 py-2 text-xs rounded-xl border border-emerald-100 bg-white/70 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      placeholder="https://api.openai.com/v1 或 https://your-proxy/v1"
                      value={multiApiConfig.apiurl}
                      onChange={e => updateMultiApi({ apiurl: e.target.value })}
                      onBlur={e => updateMultiApi({ apiurl: normalizeApiUrl(e.target.value) })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">API Key</label>
                    <input
                      type="password"
                      className="w-full px-2.5 py-2 text-xs rounded-xl border border-emerald-100 bg-white/70 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      placeholder="sk-..."
                      value={multiApiConfig.key}
                      onChange={e => updateMultiApi({ key: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">模型</label>
                    <input
                      className="w-full px-2.5 py-2 text-xs rounded-xl border border-emerald-100 bg-white/70 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      placeholder="gpt-4o-mini"
                      value={multiApiConfig.model}
                      onChange={e => updateMultiApi({ model: e.target.value })}
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{hasModelList ? '支持拉取模型列表' : '当前环境无法拉取模型列表，请手动输入'}</span>
                      <button
                        onClick={handleFetchModels}
                        className="px-2 py-1 rounded-lg border border-emerald-100 bg-white/60 text-emerald-700 hover:bg-emerald-50 transition-colors"
                        disabled={isFetchingModels}
                      >
                        {isFetchingModels ? '获取中...' : '获取可用模型'}
                      </button>
                    </div>
                    {modelOptions.length > 0 && (
                      <div className="max-h-36 overflow-y-auto rounded-xl border border-emerald-100 bg-white/70 custom-scrollbar">
                        {modelOptions.map(model => (
                          <button
                            key={model}
                            onClick={() => updateMultiApi({ model })}
                            className={`w-full text-left px-3 py-2 text-xs border-b border-emerald-50 transition-colors ${
                              model === multiApiConfig.model ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-emerald-50'
                            }`}
                          >
                            {model}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">最大重试 (0-10)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      className="w-full px-2.5 py-2 text-xs rounded-xl border border-emerald-100 bg-white/70 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={multiApiConfig.retries}
                      onChange={e => updateMultiApi({ retries: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleTestConnection}
                      className="px-3 py-2 text-xs font-bold rounded-xl border border-emerald-100 bg-white/60 text-emerald-700 hover:bg-emerald-50 transition-colors"
                      disabled={isTestingApi}
                    >
                      {isTestingApi ? '测试中...' : '尝试连接'}
                    </button>
                    <button
                      onClick={handleTestOutput}
                      className="px-3 py-2 text-xs font-bold rounded-xl border border-emerald-100 bg-white/60 text-emerald-700 hover:bg-emerald-50 transition-colors"
                    >
                      测试输出
                    </button>
                  </div>
                  <div className="space-y-1 text-[10px] text-slate-500">
                    <div>
                      连接状态：
                      <span
                        className={`ml-1 font-bold ${
                          connectionStatus === 'success'
                            ? 'text-emerald-600'
                            : connectionStatus === 'error'
                              ? 'text-rose-500'
                              : 'text-slate-400'
                        }`}
                      >
                        {connectionStatus === 'idle' ? '未测试' : connectionMessage}
                      </span>
                    </div>
                    <div>
                      输出状态：
                      <span
                        className={`ml-1 font-bold ${
                          outputStatus === 'success'
                            ? 'text-emerald-600'
                            : outputStatus === 'error'
                              ? 'text-rose-500'
                              : 'text-slate-400'
                        }`}
                      >
                        {outputStatus === 'idle' ? '未测试' : outputMessage}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white/40 border border-emerald-100 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  仙缘商城刷新 API 配置
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">API URL（OpenAI兼容）</label>
                    <input
                      className="w-full px-2.5 py-2 text-xs rounded-xl border border-emerald-100 bg-white/70 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      placeholder="https://api.openai.com/v1 或 https://your-proxy/v1"
                      value={shopApiConfig.apiurl}
                      onChange={e => updateShopApi({ apiurl: e.target.value })}
                      onBlur={e => updateShopApi({ apiurl: normalizeApiUrl(e.target.value) })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">API Key</label>
                    <input
                      type="password"
                      className="w-full px-2.5 py-2 text-xs rounded-xl border border-emerald-100 bg-white/70 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      placeholder="sk-..."
                      value={shopApiConfig.key}
                      onChange={e => updateShopApi({ key: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">模型</label>
                    <input
                      className="w-full px-2.5 py-2 text-xs rounded-xl border border-emerald-100 bg-white/70 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      placeholder="gpt-4o-mini"
                      value={shopApiConfig.model}
                      onChange={e => updateShopApi({ model: e.target.value })}
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{hasModelList ? '支持拉取模型列表' : '当前环境无法拉取模型列表，请手动输入'}</span>
                      <button
                        onClick={handleFetchShopModels}
                        className="px-2 py-1 rounded-lg border border-emerald-100 bg-white/60 text-emerald-700 hover:bg-emerald-50 transition-colors"
                        disabled={isFetchingShopModels}
                      >
                        {isFetchingShopModels ? '获取中...' : '获取可用模型'}
                      </button>
                    </div>
                    {shopModelOptions.length > 0 && (
                      <div className="max-h-36 overflow-y-auto rounded-xl border border-emerald-100 bg-white/70 custom-scrollbar">
                        {shopModelOptions.map(model => (
                          <button
                            key={model}
                            onClick={() => updateShopApi({ model })}
                            className={`w-full text-left px-3 py-2 text-xs border-b border-emerald-50 transition-colors ${
                              model === shopApiConfig.model ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-emerald-50'
                            }`}
                          >
                            {model}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">最大重试 (0-10)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      className="w-full px-2.5 py-2 text-xs rounded-xl border border-emerald-100 bg-white/70 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={shopApiConfig.retries}
                      onChange={e => updateShopApi({ retries: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleTestShopConnection}
                      className="px-3 py-2 text-xs font-bold rounded-xl border border-emerald-100 bg-white/60 text-emerald-700 hover:bg-emerald-50 transition-colors"
                      disabled={isTestingShopApi}
                    >
                      {isTestingShopApi ? '测试中...' : '尝试连接'}
                    </button>
                    <button
                      onClick={handleTestShopOutput}
                      className="px-3 py-2 text-xs font-bold rounded-xl border border-emerald-100 bg-white/60 text-emerald-700 hover:bg-emerald-50 transition-colors"
                    >
                      测试输出
                    </button>
                  </div>
                  <div className="space-y-1 text-[10px] text-slate-500">
                    <div>
                      连接状态：
                      <span
                        className={`ml-1 font-bold ${
                          shopConnectionStatus === 'success'
                            ? 'text-emerald-600'
                            : shopConnectionStatus === 'error'
                              ? 'text-rose-500'
                              : 'text-slate-400'
                        }`}
                      >
                        {shopConnectionStatus === 'idle' ? '未测试' : shopConnectionMessage}
                      </span>
                    </div>
                    <div>
                      输出状态：
                      <span
                        className={`ml-1 font-bold ${
                          shopOutputStatus === 'success'
                            ? 'text-emerald-600'
                            : shopOutputStatus === 'error'
                              ? 'text-rose-500'
                              : 'text-slate-400'
                        }`}
                      >
                        {shopOutputStatus === 'idle' ? '未测试' : shopOutputMessage}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiModeModal;



