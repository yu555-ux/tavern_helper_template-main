import { useCallback, useRef, useState } from 'react';

import { parseMaintext } from '../utils/parsers/maintext';
import { getWorldbookEntryContents } from '../utils/worldbook';

/**
 * 验证消息是否符合太虚界规范
 * 至少包含完整闭合的 <maintext> 与 <option> 标签
 */
function validateTaixujieMessage(content: string): boolean {
  if (!content || typeof content !== 'string') return false;

  // 1. 检查 <maintext> 闭合标签
  if (!content.includes('</maintext>')) {
    return false;
  }

  // 2. 检查 <option> 闭合标签
  if (!content.includes('</option>')) {
    return false;
  }

  // 3. 提取并检查内容是否为空
  const maintextMatch = content.match(/<maintext>([\s\S]*?)<\/maintext>/i);
  if (!maintextMatch || !maintextMatch[1].trim()) {
    return false;
  }

  return true;
}

function getLastClosedMaintext(content: string): string {
  const matches = content.match(/<maintext>([\s\S]*?)<\/maintext>/gi);
  if (!matches || matches.length === 0) return parseMaintext(content);
  const last = matches[matches.length - 1];
  const innerMatch = last.match(/<maintext>([\s\S]*?)<\/maintext>/i);
  return innerMatch ? innerMatch[1].trim() : parseMaintext(content);
}

function normalizeSecondApiOutput(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<updateVarlible>/gi, '<UpdateVariable>')
    .replace(/<\/updateVarlible>/gi, '</UpdateVariable>');
}

function stripVariableSections(content: string): string {
  if (!content) return '';
  return content
    .replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, '')
    .replace(/<updateVarlible>[\s\S]*?<\/updateVarlible>/gi, '')
    .replace(/<JSONPatch>[\s\S]*?<\/JSONPatch>/gi, '')
    .trim();
}

type MultiApiConfig = {
  apiurl: string;
  key: string;
  model: string;
  retries: number;
};

type MultiApiOptions = {
  multiApiEnabled?: boolean;
  multiApiConfig?: MultiApiConfig;
  onUpdateMvuData?: (newData: any) => void;
};

type FocusSettings = {
  hideInterval: number;
  keepCount: number;
};

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

const normalizeFocusSettings = (input?: Partial<FocusSettings>): FocusSettings => {
  return {
    hideInterval: clamp(Number(input?.hideInterval) || 0, 1, 5000),
    keepCount: clamp(Number(input?.keepCount) || 0, 1, 5000)
  };
};

/**
 * 太虚界与酒馆交互的自定义 Hook
 * 处理消息发送、AI 生成以及斜杠指令的自动触发
 */
export function useTavernInteraction(
  mvuData: any,
  isFocusMode: boolean = false,
  focusSettings?: Partial<FocusSettings>,
  options?: MultiApiOptions
) {
  const [isGenerating, setIsGenerating] = useState(false);
  const multiApiEnabled = options?.multiApiEnabled ?? false;
  const multiApiConfig = options?.multiApiConfig;
  const onUpdateMvuData = options?.onUpdateMvuData;
  const activeStreamStopRef = useRef<{ stop: () => void } | null>(null);
  const activeStreamSessionRef = useRef<string | null>(null);

  const resolveRecentMessageId = useCallback((marker: string, role: 'user' | 'assistant') => {
    try {
      const lastId = getLastMessageId();
      if (lastId < 0) return null;
      const start = Math.max(0, lastId - 8);
      const messages = getChatMessages(`${start}-${lastId}`);
      const found = [...messages].reverse().find(m => m.role === role && (m as any)?.data?.__txj_marker === marker);
      if (!found) {
        return null;
      }
      return found.message_id;
    } catch {
      return null;
    }
  }, []);

  const createMessageWithMarker = useCallback(async (role: 'user' | 'assistant', message: string, data?: any) => {
    const marker = `txj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await createChatMessages(
      [{ role, message, data: { ...(data || {}), __txj_marker: marker } }],
      { refresh: 'none' },
    );
    return resolveRecentMessageId(marker, role);
  }, [resolveRecentMessageId]);

  const runSecondApiOnMaintext = useCallback(async (
    maintext: string,
    options?: { allowWhenDisabled?: boolean; forceMainApi?: boolean }
  ) => {
    const allowWhenDisabled = options?.allowWhenDisabled ?? false;
    const forceMainApi = options?.forceMainApi ?? false;
    const useMainApi = forceMainApi || (!multiApiEnabled && allowWhenDisabled);

    console.info('[MultiApi] runMultiApiUpdate', {
      enabled: multiApiEnabled,
      hasConfig: !!multiApiConfig,
      useMainApi
    });

    let apiConfig: MultiApiConfig | null = null;
    if (!useMainApi) {
      if (!multiApiEnabled) return;
      if (!multiApiConfig) {
        toastr.warning('多API已开启，但第二API配置不完整');
        return;
      }
      if (!multiApiConfig.apiurl || !multiApiConfig.model) {
        toastr.warning('多API已开启，但第二API配置不完整');
        console.info('[MultiApi] invalid config', {
          apiurl: !!multiApiConfig.apiurl,
          model: !!multiApiConfig.model
        });
        return;
      }
      apiConfig = multiApiConfig;
    }

    if (!maintext) {
      return;
    }

    const taskText = [
      '第二API任务：',
      '你只需要输出变量更新结果。',
      '请严格按照变量更新规范，仅输出<updateVarlible>内容，不要输出其他标签或说明。'
    ].join('\n');

    const currentVariablesJson = JSON.stringify(mvuData, null, 2);

    const wbContents = await getWorldbookEntryContents([
      '[数值]境界数值基准',
      '[数值]物品数值基准',
      '[mvu_update]变量列表',
      '[mvu_update]变量更新规则',
      '[mvu_update]依存度变化规则',
      '[mvu_update]总堕落值变化规则',
      '[mvu_update]变量输出格式'
    ]);

    const prompt = [
      '当前主API正文：',
      maintext,
      '境界数值基准：',
      wbContents['[数值]境界数值基准'] || '',
      '物品数值基准：',
      wbContents['[数值]物品数值基准'] || '',
      '变量列表：',
      wbContents['[mvu_update]变量列表'] || '',
      '变量更新规则：',
      wbContents['[mvu_update]变量更新规则'] || '',
      '依存度变化规则：',
      wbContents['[mvu_update]依存度变化规则'] || '',
      '总堕落值变化规则：',
      wbContents['[mvu_update]总堕落值变化规则'] || '',
      '变量更新格式：',
      wbContents['[mvu_update]变量输出格式'] || '',
      '当前变量数据(JSON)：',
      currentVariablesJson,
      taskText
    ].join('\n\n');

    const retries = Math.max(0, Math.min(10, Number(multiApiConfig?.retries) || 0));
    let lastError: any = null;
    let raw = '';
    for (let i = 0; i <= retries; i += 1) {
      try {
        if (useMainApi) {
          raw = await generateRaw({
            user_input: prompt,
            ordered_prompts: ['user_input']
          });
        } else {
          if (!apiConfig) {
            throw new Error('SECOND_API_CONFIG_MISSING');
          }
          raw = await generateRaw({
            user_input: prompt,
            ordered_prompts: ['user_input'],
            custom_api: {
              apiurl: apiConfig.apiurl,
              key: apiConfig.key,
              model: apiConfig.model,
              source: 'openai'
            }
          });
        }
        lastError = null;
        break;
      } catch (error: any) {
        lastError = error;
      }
    }

    if (lastError) {
      toastr.error(`第二API调用失败: ${lastError.message || '未知错误'}`);
      return;
    }

    const normalized = normalizeSecondApiOutput(raw || '');
    if (!normalized) {
      toastr.warning('第二API未返回可解析的变量更新');
      console.info('[MultiApi] empty normalized output', {
        rawPreview: (raw || '').slice(0, 500)
      });
      return;
    }
    toastr.success('第二API变量更新成功');
    console.info('[MultiApi] normalized output', {
      length: normalized.length,
      normalizedPreview: normalized.slice(0, 500)
    });
    return normalized;
  }, [multiApiEnabled, multiApiConfig, onUpdateMvuData, mvuData]);

  const runMultiApiUpdate = useCallback(async (mainResponse: string) => {
    const maintext = getLastClosedMaintext(mainResponse);
    const updateText = await runSecondApiOnMaintext(maintext);
    if (!updateText) return;
    return {
      combinedResponse: `${mainResponse}\n${updateText}`
    };
  }, [runSecondApiOnMaintext]);

  const sendMessage = useCallback(async (text: string, options?: { instructions?: string[] }) => {
    const hasInstructions = (options?.instructions?.length ?? 0) > 0;
    if (isGenerating || (!text.trim() && !hasInstructions)) return;

    // 记录发送前的起始楼层 ID（用于回滚）
    const initialLastId = getLastMessageId();
    let userMessageId: number | null = null;
    let assistantMessageId: number | null = null;
    setIsGenerating(true);

    try {
      // 专注模式：按间隔修剪上下文，仅保留最近 N 条
      if (isFocusMode) {
        const focus = normalizeFocusSettings(focusSettings);
        if (initialLastId >= focus.keepCount) {
          const shouldHide = focus.hideInterval <= 1 || (initialLastId % focus.hideInterval === focus.hideInterval - 1);
          if (shouldHide) {
            const hideUntil = Math.max(0, initialLastId - focus.keepCount);
            if (hideUntil >= 0) {
              const hideRange = `0-${hideUntil}`;
              await triggerSlash(`/hide ${hideRange}`);
            }
          }
        }
      }

      let finalUserMessage = text.trim() || '（确定因果）';

      // 1. 构建提示词（指令集处理）
      if (options?.instructions && options.instructions.length > 0) {
        const instructionPrefix = options.instructions
          .map((instr, idx) => `${idx + 1}、${instr}`)
          .join('\n');
        finalUserMessage = `${instructionPrefix}\n\n${finalUserMessage}`;
      }

      // 2. 创建 user 消息，不刷新
      const createdUserId = await createMessageWithMarker('user', finalUserMessage, { stat_data: mvuData });
      const lastId = getLastMessageId();
      userMessageId = createdUserId ?? lastId;
      if (!createdUserId) {
      }

      // 3. 预创建 assistant 楼层，用于流式显示
      const createdAssistantId = await createMessageWithMarker('assistant', '', { stat_data: mvuData });
      assistantMessageId = createdAssistantId ?? (lastId + 1);
      if (!createdAssistantId) {
      }

      // 4. 调用 generate 请求 AI，并开启流式
      let finalAiResponse = '';

      if (activeStreamStopRef.current) {
        console.warn('[TxjMsg] stop previous stream listener');
        activeStreamStopRef.current.stop();
        activeStreamStopRef.current = null;
      }
      const streamSession = `txj-stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      activeStreamSessionRef.current = streamSession;
      const stopStreaming = eventOn(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, async (tokenContent) => {
        if (activeStreamSessionRef.current !== streamSession) {
          return;
        }
        finalAiResponse = tokenContent;
        if (assistantMessageId !== null) {
          await setChatMessages([{ message_id: assistantMessageId, message: tokenContent }], { refresh: 'none' });
        }
        eventEmit('PSEUDO_SAME_LAYER_UPDATE');
      });
      activeStreamStopRef.current = stopStreaming;

      try {
        await generate({ user_input: finalUserMessage, should_stream: true });
      } finally {
        stopStreaming.stop();
        if (activeStreamStopRef.current === stopStreaming) {
          activeStreamStopRef.current = null;
        }
      }

      // 格式校验：回复必须符合太虚界规范
      if (!validateTaixujieMessage(finalAiResponse)) {
        throw new Error('REPLY_INVALID_FORMAT');
      }

      const multiApiResult = await runMultiApiUpdate(finalAiResponse);
      if (multiApiResult?.combinedResponse && assistantMessageId !== null) {
        await setChatMessages([{ message_id: assistantMessageId, message: multiApiResult.combinedResponse }], { refresh: 'none' });
        finalAiResponse = multiApiResult.combinedResponse;
      }
      // 手动触发 MVU 解析并写回变量
      try {
        if (typeof Mvu !== 'undefined') {
          await waitGlobalInitialized('Mvu');
          const oldMvuData = { stat_data: mvuData };
          const newMvuData = await Mvu.parseMessage(finalAiResponse, oldMvuData as any);
          if (newMvuData) {
            await Mvu.replaceMvuData(newMvuData, { type: 'message', message_id: assistantMessageId });
          }
        }
      } catch (e) {
      }

      // 5. 最终同步（由 App.tsx 监听事件完成变量和历史解析）
      eventEmit('PSEUDO_SAME_LAYER_UPDATE');

      return finalAiResponse;
    } catch (error: any) {

      // 回滚逻辑：删除失败的楼层
      const idsToDelete: number[] = [];
      if (assistantMessageId !== null) idsToDelete.push(assistantMessageId);
      if (userMessageId !== null) idsToDelete.push(userMessageId);

      if (idsToDelete.length > 0) {
        // 优化：不再使用 refresh: 'all'，防止干扰酒馆正常的楼层显示状态
        await deleteChatMessages(idsToDelete, { refresh: 'none' });
      }
      // 强制刷新 UI 回到最近有效楼层
      eventEmit('PSEUDO_SAME_LAYER_UPDATE');

      const errorMsg = error.message === 'REPLY_INVALID_FORMAT'
        ? '天机泄露，法理不全（回复格式错误）'
        : '灵力紊乱，生成失败';
      toastr.error(errorMsg, '系统错误');

      // 向上抛出异常，便于上层恢复输入
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, isFocusMode, focusSettings, mvuData, runMultiApiUpdate]);

  const regenerateFromUserMessage = useCallback(async (userMessageId: number, assistantMessageId?: number) => {
    if (isGenerating) return;
    setIsGenerating(true);

    let newAssistantMessageId: number | null = null;
    try {
      const userMessages = getChatMessages(userMessageId, { role: 'user' });
      if (!userMessages || userMessages.length === 0) {
        throw new Error('USER_MESSAGE_NOT_FOUND');
      }

      const finalUserMessage = userMessages[0].message;

      if (assistantMessageId !== undefined) {
        await deleteChatMessages([assistantMessageId], { refresh: 'none' });
      }

      const lastId = getLastMessageId();
      newAssistantMessageId = lastId + 1;

      const createdAssistantId = await createMessageWithMarker('assistant', '', { stat_data: mvuData });
      newAssistantMessageId = createdAssistantId ?? (lastId + 1);
      if (!createdAssistantId) {
      }

      let finalAiResponse = '';

      if (activeStreamStopRef.current) {
        console.warn('[TxjMsg] stop previous stream listener');
        activeStreamStopRef.current.stop();
        activeStreamStopRef.current = null;
      }
      const streamSession = `txj-stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      activeStreamSessionRef.current = streamSession;
      const stopStreaming = eventOn(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, async (tokenContent) => {
        if (activeStreamSessionRef.current !== streamSession) {
          return;
        }
        finalAiResponse = tokenContent;
        if (newAssistantMessageId !== null) {
          await setChatMessages([{ message_id: newAssistantMessageId, message: tokenContent }], { refresh: 'none' });
        }
        eventEmit('PSEUDO_SAME_LAYER_UPDATE');
      });
      activeStreamStopRef.current = stopStreaming;

      try {
        await generate({ user_input: finalUserMessage, should_stream: true });
      } finally {
        stopStreaming.stop();
        if (activeStreamStopRef.current === stopStreaming) {
          activeStreamStopRef.current = null;
        }
      }

      if (!validateTaixujieMessage(finalAiResponse)) {
        throw new Error('REPLY_INVALID_FORMAT');
      }

      const multiApiResult = await runMultiApiUpdate(finalAiResponse);
      if (multiApiResult?.combinedResponse && newAssistantMessageId !== null) {
        await setChatMessages([{ message_id: newAssistantMessageId, message: multiApiResult.combinedResponse }], { refresh: 'none' });
        finalAiResponse = multiApiResult.combinedResponse;
      }
      try {
        if (typeof Mvu !== 'undefined') {
          await waitGlobalInitialized('Mvu');
          const oldMvuData = { stat_data: mvuData };
          const newMvuData = await Mvu.parseMessage(finalAiResponse, oldMvuData as any);
          if (newMvuData && newAssistantMessageId !== null) {
            await Mvu.replaceMvuData(newMvuData, { type: 'message', message_id: newAssistantMessageId });
          }
        }
      } catch (e) {
      }

      eventEmit('PSEUDO_SAME_LAYER_UPDATE');
      return finalAiResponse;
    } catch (error: any) {

      const idsToDelete: number[] = [];
      if (newAssistantMessageId !== null) idsToDelete.push(newAssistantMessageId);
      // 重roll 失败时回退到输入态：删除用户楼层
      if (typeof userMessageId === 'number') idsToDelete.push(userMessageId);

      if (idsToDelete.length > 0) {
        await deleteChatMessages(idsToDelete, { refresh: 'none' });
      }
      // 强制刷新 UI 回到最近有效楼层
      eventEmit('PSEUDO_SAME_LAYER_UPDATE');

      const errorMsg = error.message === 'REPLY_INVALID_FORMAT'
        ? '天机泄露，法理不全（回复格式错误）'
        : '灵力紊乱，生成失败';
      toastr.error(errorMsg, '系统错误');

      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, mvuData, runMultiApiUpdate]);

  const rerollVariablesFromMessage = useCallback(async (assistantMessageId: number, fullMessage: string) => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      const maintext = getLastClosedMaintext(fullMessage);
      const updateText = await runSecondApiOnMaintext(maintext, { allowWhenDisabled: true });
      if (!updateText) {
        throw new Error('SECOND_API_EMPTY');
      }

      const baseContent = stripVariableSections(fullMessage);
      const merged = `${baseContent}\n${updateText}`;

      await setChatMessages([{ message_id: assistantMessageId, message: merged }], { refresh: 'none' });

      try {
        if (typeof Mvu !== 'undefined') {
          await waitGlobalInitialized('Mvu');
          const oldMvuData = { stat_data: mvuData };
          const newMvuData = await Mvu.parseMessage(merged, oldMvuData as any);
          if (newMvuData) {
            await Mvu.replaceMvuData(newMvuData, { type: 'message', message_id: assistantMessageId });
          }
        }
      } catch (e) {
      }

      eventEmit('PSEUDO_SAME_LAYER_UPDATE');
      return merged;
    } catch (error: any) {
      const errorMsg = error.message === 'SECOND_API_EMPTY'
        ? '第二API未返回可用变量'
        : '变量重roll失败';
      toastr.error(errorMsg, '系统错误');
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, mvuData, runSecondApiOnMaintext]);

  return {
    isGenerating,
    sendMessage,
    regenerateFromUserMessage,
    rerollVariablesFromMessage,
  };
}
