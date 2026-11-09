import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  X,
  Send,
  Sparkles,
  Loader2,
  ChevronDown,
  ImagePlus,
  Square,
  Check,
  RefreshCw,
  Database,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  CHAT_OPTIONS,
  CHAT_URL,
  DEFAULT_MODEL,
  KEEP_ALIVE,
  MAX_HISTORY_MESSAGES,
  THINK,
  fetchModels,
  formatModelSize,
  getSavedModel,
  pickModel,
  saveModel,
  type OllamaModel,
} from '@/features/ai/config';
import { buildLedgerDigest, type LedgerStats } from '@/features/ai/ledgerDigest';
import { buildSystemPrompt, QUICK_QUESTIONS, WELCOME_MESSAGE } from '@/features/ai/prompt';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** base64 图片（不含 data: 前缀） */
  image?: string;
}

type ModelStatus = 'checking' | 'online' | 'offline';

/**
 * 流式 <think> 标签剥离器：逐块喂入文本，把可能混进正文的思考片段剔掉。
 *
 * 请求里已固定 `think: false`，正常情况下不会出现思考内容；
 * 这里保留解析只是兜底 —— 某些模型会无视开关、自己吐 <think> 标签，
 * 不剥掉就会以乱码形式显示在答案里。
 */
function createThinkParser() {
  const TAGS = ['<think>', ' thinking', '</think>', '<｜end▁of▁thinking｜>'];
  let inThink = false;
  let thinkBuf = '';
  let contentBuf = '';
  let pending = '';

  function feed(delta: string) {
    pending += delta;
    let guard = 0;
    while (pending && guard++ < 10000) {
      if (!inThink) {
        const hit = TAGS.slice(0, 2).find((t) => pending.startsWith(t));
        if (hit) {
          pending = pending.slice(hit.length);
          inThink = true;
          continue;
        }
      } else {
        const hit = TAGS.slice(2).find((t) => pending.startsWith(t));
        if (hit) {
          pending = pending.slice(hit.length);
          inThink = false;
          continue;
        }
      }
      // 当前缓冲是否是某个标签的开头，是则等待下一块补全
      if (TAGS.some((t) => t.startsWith(pending))) break;
      const ch = pending[0];
      pending = pending.slice(1);
      if (inThink) thinkBuf += ch;
      else contentBuf += ch;
    }
  }

  function flush() {
    if (pending) {
      if (inThink) thinkBuf += pending;
      else contentBuf += pending;
      pending = '';
    }
  }

  function getResult() {
    return { thinking: thinkBuf, content: contentBuf };
  }

  return { feed, flush, getResult };
}

/** 单条 AI 消息气泡 */
function AssistantBubble({ msg, streaming }: { msg: ChatMessage; streaming?: boolean }) {
  return (
    <div className="max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed bg-white text-foreground shadow-sm rounded-bl-md border border-border/40 prose prose-sm prose-slate max-w-none prose-p:my-1.5 prose-headings:my-2 prose-headings:text-[13px] prose-strong:text-foreground prose-ul:my-1.5 prose-li:my-0.5 prose-code:bg-muted/80 prose-code:px-1 prose-code:rounded prose-code:text-[12px] prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:my-2">
      {msg.content ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
      ) : streaming ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>正在生成…</span>
        </div>
      ) : null}
    </div>
  );
}


export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('checking');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [model, setModel] = useState<string>(() => getSavedModel() || DEFAULT_MODEL);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [stats, setStats] = useState<LedgerStats | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoScrollRef = useRef(true);
  const frameRef = useRef(0);

  /** 读取账本统计（只用于界面展示「已加载多少数据」） */
  const refreshStats = useCallback(() => {
    try {
      setStats(buildLedgerDigest().stats);
    } catch {
      setStats(null);
    }
  }, []);

  /** 探测 Ollama + 拉模型列表 + 预热模型 */
  const refreshEnv = useCallback(
    async (warmup: boolean) => {
      setModelStatus('checking');
      refreshStats();
      const list = await fetchModels();
      setModels(list);
      if (list.length === 0) {
        setModelStatus('offline');
        return;
      }
      setModelStatus('online');
      const picked = pickModel(list);
      setModel(picked);

      if (warmup) {
        try {
          await fetch(CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: picked,
              messages: [{ role: 'user', content: '.' }],
              stream: false,
              // 预热只加载权重，绝不能开思考（否则要等一整段推理）
              think: false,
              keep_alive: KEEP_ALIVE,
              options: { num_predict: 1 },
            }),
          });
        } catch {
          /* 预热失败不影响后续请求 */
        }
      }
    },
    [refreshStats],
  );

  // 首次挂载：只探测状态（不预热，避免无谓加载）
  useEffect(() => {
    refreshEnv(false);
  }, [refreshEnv]);

  // 页面关闭/刷新时卸载模型，释放内存
  useEffect(() => {
    const handleBeforeUnload = () => {
      const blob = new Blob([JSON.stringify({ model, prompt: '', keep_alive: 0, stream: false })], {
        type: 'application/json',
      });
      navigator.sendBeacon(`${CHAT_URL.replace('/api/chat', '/api/generate')}`, blob);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [model]);

  // 滚动跟随
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  useEffect(() => {
    if (autoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, loading]);

  // 打开抽屉：重新探测 + 预热 + 刷新账本统计
  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 300);
    refreshEnv(true);
  }, [open, refreshEnv]);

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || loading) return;

      // 每次提问都重新读取账本，保证分析的是最新数据
      let digest;
      try {
        digest = buildLedgerDigest();
        setStats(digest.stats);
      } catch {
        digest = null;
      }

      const userMsg: ChatMessage = {
        role: 'user',
        content: text,
        image: pendingImage || undefined,
      };
      const history = [...messages, userMsg];

      setMessages([...history, { role: 'assistant', content: '' }]);
      setInput('');
      setPendingImage(null);
      setLoading(true);
      autoScrollRef.current = true;

      try {
        const systemPrompt = digest
          ? buildSystemPrompt(digest)
          : '你是个人资产分析助手。当前账本尚未加载，请告知用户先在页面上打开一个账本文件。';

        // 历史消息：去掉空内容、去掉图片（视觉输入对当前模型不可靠，且占用上下文）
        const historyPayload = history
          .filter((m) => m.content.trim().length > 0)
          .slice(-MAX_HISTORY_MESSAGES)
          .map((m) => ({ role: m.role, content: m.content }));

        abortRef.current = new AbortController();

        const res = await fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: systemPrompt }, ...historyPayload],
            stream: true,
            // think 是 ollama 的顶层参数，不属于 options；固定关闭，思考 token 归零
            think: THINK,
            keep_alive: KEEP_ALIVE,
            options: CHAT_OPTIONS,
          }),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${body.slice(0, 300)}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const parser = createThinkParser();
        let finished = false;

        while (!finished) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let chunk: {
              message?: { content?: string; thinking?: string };
              done?: boolean;
              error?: string;
            };
            try {
              chunk = JSON.parse(trimmed);
            } catch {
              continue;
            }
            if (chunk.error) throw new Error(chunk.error);

            const delta = chunk.message?.content || '';
            const thinkingDelta = chunk.message?.thinking || '';
            if (delta) parser.feed(delta);
            if (thinkingDelta) parser.feed(`<think>${thinkingDelta}</think>`);

            // 模型逐字吐 token，合并到每帧一次渲染，避免高频 re-render 卡顿
            if (!frameRef.current) {
              frameRef.current = requestAnimationFrame(() => {
                frameRef.current = 0;
                const { content } = parser.getResult();
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  next[next.length - 1] = { ...last, content };
                  return next;
                });
              });
            }

            if (chunk.done) {
              finished = true;
              break;
            }
          }
        }

        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = 0;
        }
        parser.flush();
        const finalResult = parser.getResult();
        // 兜底：正文为空时必须明确告知，而不是留一片空白让人干等
        const finalContent =
          finalResult.content.trim().length > 0
            ? finalResult.content
            : '⚠️ 模型没有返回内容，请重试。';
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = {
            ...last,
            content: finalContent,
          };
          return next;
        });
      } catch (err) {
        const isAbort = (err as Error).name === 'AbortError';
        if (isAbort) {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last.content) {
              next[next.length - 1] = { ...last, content: `${last.content}\n\n---\n*已中断生成*` };
            }
            return next;
          });
        } else {
          const errorMsg = err instanceof Error ? err.message : '未知错误';
          const notFound = /not found|does not exist|未找到/i.test(errorMsg);
          const offline = /failed to fetch|networkerror|load failed/i.test(errorMsg);
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: 'assistant',
              content: notFound
                ? `⚠️ 本机 Ollama 里没有模型 \`${model}\`。\n\n已安装的模型：${models.map((m) => `\`${m.name}\``).join('、') || '（未读取到）'}\n\n点上方模型名可以切换。`
                : offline
                  ? `⚠️ 连不上本地 Ollama（${CHAT_URL}）。\n\n请确认：\n1. 终端执行 \`ollama serve\` 已启动\n2. 地址没被代理/防火墙拦截\n\n错误：${errorMsg}`
                  : `⚠️ 请求失败：${errorMsg}`,
            };
            return next;
          });
          if (notFound || offline) setModelStatus('offline');
        }
      } finally {
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = 0;
        }
        setLoading(false);
        abortRef.current = null;
      }
    },
    [input, loading, messages, model, models, pendingImage],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImage(await fileToBase64(file));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          fileToBase64(file).then(setPendingImage);
          e.preventDefault();
          return;
        }
      }
    }
  };

  const statusDot =
    modelStatus === 'online'
      ? 'bg-[#34C759]'
      : modelStatus === 'checking'
        ? 'bg-[#FF9500] animate-pulse'
        : 'bg-[#8E8E93]';

  const statusText =
    modelStatus === 'online' ? '在线' : modelStatus === 'checking' ? '连接中' : '离线';

  const showQuickQuestions = messages.length <= 1;

  return (
    <>
      {/* 右下角悬浮按钮 */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-20 right-6 z-[60] size-14 rounded-full bg-[#007AFF] text-white shadow-lg shadow-[#007AFF]/30 flex items-center justify-center transition-all hover:scale-105 hover:bg-[#0066CC] active:scale-95 ${
          open ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        }`}
        aria-label="打开 AI 分析助手"
        title="AI 分析助手"
      >
        <Sparkles className="size-6" strokeWidth={2} />
      </button>

      {/* 居中弹窗：宽度与页面内容区同一套约束（max-w-6xl + px-4 md:px-6），左右边缘对齐 */}
      <div
        className={`fixed inset-0 z-[60] flex items-center justify-center px-4 md:px-6 py-6 transition-opacity duration-200 ${
          open ? 'bg-black/25 opacity-100' : 'bg-transparent opacity-0 pointer-events-none'
        }`}
        onClick={() => {
          setOpen(false);
          setModelMenuOpen(false);
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI 账房先生"
          onClick={(e) => e.stopPropagation()}
          className={`flex flex-col w-full max-w-6xl h-[min(86vh,820px)] bg-white rounded-2xl border border-border/50 shadow-2xl overflow-hidden transition-transform duration-200 ease-out ${
            open ? 'scale-100' : 'scale-95'
          }`}
        >
        {/* 顶部栏 */}
        <div className="flex items-start justify-between px-5 py-3.5 border-b border-border/60 bg-white/80 backdrop-blur-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-lg bg-[#007AFF]/10 flex items-center justify-center shrink-0">
              <Bot className="size-4 text-[#007AFF]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground leading-tight">AI 账房先生</h2>
              {/* 模型选择 */}
              <div className="relative">
                <button
                  onClick={() => setModelMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors max-w-full"
                  title="切换模型"
                >
                  <span className={`size-1.5 rounded-full shrink-0 ${statusDot}`} />
                  <span className="truncate">{model}</span>
                  <span className="shrink-0">· {statusText}</span>
                  <ChevronDown className="size-3 shrink-0" />
                </button>
                {modelMenuOpen && (
                  <div className="absolute top-6 left-0 z-50 w-64 bg-white rounded-xl shadow-lg border border-border/40 py-1 max-h-64 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[11px] text-muted-foreground">
                      本机已安装模型
                    </div>
                    {models.length === 0 && (
                      <div className="px-3 py-2 text-[12px] text-muted-foreground">
                        未读取到模型，检查 ollama serve
                      </div>
                    )}
                    {models.map((m) => (
                      <button
                        key={m.name}
                        onClick={() => {
                          setModel(m.name);
                          saveModel(m.name);
                          setModelMenuOpen(false);
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] text-foreground truncate">{m.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {[m.params, formatModelSize(m.size)].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {model === m.name && <Check className="size-3.5 text-[#007AFF] shrink-0" />}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setModelMenuOpen(false);
                        refreshEnv(false);
                      }}
                      className="w-full px-3 py-1.5 mt-1 border-t border-border/40 flex items-center gap-1.5 text-[11px] text-[#007AFF] hover:bg-muted/60"
                    >
                      <RefreshCw className="size-3" /> 重新检测
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 账本数据条 */}
        <div className="flex items-center gap-2 px-5 py-1.5 bg-[#F8F8FA] border-b border-border/40 text-[11px] text-muted-foreground">
          <Database className="size-3 shrink-0" />
          {stats ? (
            <span className="truncate">
              已加载 {stats.recordCount} 条资产 · {stats.snapshotCount} 个快照 ·{' '}
              {stats.categoryCount} 个类别
              {stats.physicalCount > 0 ? ` · ${stats.physicalCount} 件物品` : ''}
            </span>
          ) : (
            <span>尚未读取到账本</span>
          )}
          <button
            onClick={refreshStats}
            className="ml-auto shrink-0 hover:text-foreground transition-colors"
            title="重新读取账本"
          >
            <RefreshCw className="size-3" />
          </button>
        </div>

        {/* 消息列表 */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#F8F8FA]"
        >
          {messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1;
            if (msg.role === 'user') {
              return (
                <div key={idx} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed bg-[#007AFF] text-white rounded-br-md whitespace-pre-wrap">
                    {msg.image && (
                      <img
                        src={`data:image/png;base64,${msg.image}`}
                        alt="用户图片"
                        className="max-w-full max-h-48 rounded-lg mb-2 object-cover"
                      />
                    )}
                    {msg.content}
                  </div>
                </div>
              );
            }
            return (
              <div key={idx} className="flex justify-start">
                <AssistantBubble msg={msg} streaming={isLast && loading} />
              </div>
            );
          })}

          {/* 快捷提问 */}
          {showQuickQuestions && (
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => handleSend(q.prompt)}
                  disabled={loading || modelStatus === 'offline'}
                  className="px-3 py-1.5 rounded-full bg-white border border-border/60 text-[12px] text-foreground hover:border-[#007AFF]/40 hover:text-[#007AFF] transition-colors disabled:opacity-40"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <div className="px-4 py-3 border-t border-border/60 bg-white">
          {pendingImage && (
            <div className="mb-2 flex items-center gap-2">
              <div className="relative">
                <img
                  src={`data:image/png;base64,${pendingImage}`}
                  alt="待发送图片"
                  className="h-16 w-16 rounded-lg object-cover border border-border/40"
                />
                <button
                  onClick={() => setPendingImage(null)}
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-[#FF3B30] text-white flex items-center justify-center shadow-sm"
                  aria-label="移除图片"
                >
                  <X className="size-3" />
                </button>
              </div>
              <span className="text-xs text-muted-foreground">图片已就绪</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImagePick}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="size-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="添加图片"
              title="添加图片（也可以直接粘贴）"
            >
              <ImagePlus className="size-5" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="问问你的账本…"
              disabled={loading}
              className="flex-1 h-10 px-3.5 rounded-xl bg-muted/60 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:bg-white transition-all disabled:opacity-50"
            />

            {loading ? (
              <button
                onClick={() => abortRef.current?.abort()}
                className="size-10 rounded-xl bg-[#FF3B30] text-white flex items-center justify-center transition-all hover:bg-[#D70015] active:scale-95"
                aria-label="停止生成"
                title="停止生成"
              >
                <Square className="size-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() && !pendingImage}
                className="size-10 rounded-xl bg-[#007AFF] text-white flex items-center justify-center transition-all hover:bg-[#0066CC] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#007AFF]"
                aria-label="发送"
              >
                <Send className="size-4" />
              </button>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* 遮罩层已合并进上面的居中容器，点击空白处即可关闭 */}
    </>
  );
}
