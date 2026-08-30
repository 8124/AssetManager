/**
 * 本地 JSON 文件存储模块（仅 Chrome / Edge 支持）
 *
 * 基于 File System Access API，直接操作 JSON 数据文件：
 * - 支持多账本：每个账本对应一个独立的 JSON 文件
 * - 文件句柄持久化到 IndexedDB，下次打开自动恢复并请求权限
 * - 数据变更后防抖自动写回文件
 *
 * 不支持 Safari / Firefox，这些浏览器会提示使用 Chrome。
 */

import { genId } from '@/lib/id';
import {
  computeAmountCNY,
  type IAssetRecord,
  type IExchangeRate,
  type IRecordLineEntry,
} from '@/domain/asset';
import {
  inferIconFromName,
  type IPhysicalItem,
  type IPhysicalIcon,
} from '@/domain/physical';

/* ============ 类型扩展 ============ */

type FileSystemFileHandleLike = {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
  }>;
  requestPermission?(options: { mode: 'read' | 'readwrite' }): Promise<string>;
  queryPermission?(options: { mode: 'read' | 'readwrite' }): Promise<string>;
};

type WindowWithFS = Window & {
  showOpenFilePicker?: (options: {
    multiple?: boolean;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandleLike[]>;
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandleLike>;
};

/* ============ 数据结构 ============ */

export interface AppData {
  version: number;
  asset_records: IAssetRecord[];
  asset_exchange_rate: IExchangeRate;
  physical_items: IPhysicalItem[];
  recordline: IRecordLineEntry[];
}

/** 账本元信息（不含文件句柄，可安全传给 UI） */
export interface ILedgerMeta {
  id: string;
  name: string;
  fileName: string;
  createdAt: number;
  lastOpenedAt: number;
}

/** 账本完整条目（含文件句柄，内部使用；新建账本/快照账本可无句柄） */
interface ILedgerEntry extends ILedgerMeta {
  handle?: FileSystemFileHandleLike;
}

const DATA_VERSION = 1;

const DEFAULT_RATE: IExchangeRate = {
  rate: 7.2,
  updatedAt: Date.now(),
  source: 'auto',
};

type DataKey = keyof Omit<AppData, 'version'>;

/* ============ IndexedDB 常量 ============ */

const DB_NAME = 'asset-manager-db';
const LEDGER_STORE = 'ledgers';
const ACTIVE_LEDGER_KEY = 'active_ledger_id';
const RATE_KEY_PREFIX = 'asset_exchange_rate_';
/** 每个账本一份本地快照（防抖写入，刷新不丢数据；不再原地写文件，避免 crswap） */
const SNAPSHOT_KEY_PREFIX = '__app_ledger_snapshot_';

/* ============ 工具函数 ============ */

export function createEmptyData(): AppData {
  return {
    version: DATA_VERSION,
    asset_records: [],
    asset_exchange_rate: { ...DEFAULT_RATE, updatedAt: Date.now() },
    physical_items: [],
    recordline: [],
  };
}

/* ============ 简洁导入格式解析 ============ */

function parseImportJSON(raw: string, rate: number): AppData {
  const parsed = JSON.parse(raw);
  const base = createEmptyData();

  if (Array.isArray(parsed)) {
    base.asset_records = normalizeRecords(parsed, rate);
    base.recordline = [];
    return base;
  }

  if (parsed.version != null || Array.isArray(parsed.asset_records)) {
    // 兼容旧/污染文件：asset_records 为空但 records 有数据时，优先用 records
    const hasRecordsField = Array.isArray(parsed.records) && parsed.records.length > 0;
    const assetRecordsEmpty = !Array.isArray(parsed.asset_records) || parsed.asset_records.length === 0;
    const recordsSource = hasRecordsField && assetRecordsEmpty ? parsed.records : (parsed.asset_records ?? []);
    return {
      ...base,
      ...parsed,
      version: DATA_VERSION,
      asset_records: normalizeRecords(recordsSource, rate),
      asset_exchange_rate: parsed.asset_exchange_rate ?? base.asset_exchange_rate,
      physical_items: normalizePhysicalItems(parsed.physical_items ?? []),
      recordline: Array.isArray(parsed.recordline) ? parsed.recordline : [],
    };
  }

  if (parsed.records || parsed.physical_items) {
    base.asset_records = normalizeRecords(parsed.records ?? [], rate);
    base.physical_items = normalizePhysicalItems(parsed.physical_items ?? []);
    base.recordline = Array.isArray(parsed.recordline) ? parsed.recordline : [];
    return base;
  }

  throw new Error('无法识别的 JSON 格式');
}

/**
 * 解析资产记录币种（默认为人民币）：
 * - 优先读显式 currency 字段：USD/US/美元/美金/$ → 美元；其他/缺失 → 人民币
 * - currency 缺失时，按 category 中的"美元/USD"提示兜底（兼容旧账本用类别标记美元资产）
 */
function resolveCurrency(r: Record<string, unknown>): 'CNY' | 'USD' {
  const raw = r.currency;
  if (typeof raw === 'string' && raw.trim()) {
    if (/^(USD|US|美元|美金|\$)$/i.test(raw.trim())) return 'USD';
    return 'CNY';
  }
  const category = typeof r.category === 'string' ? r.category : '';
  if (/(美元|USD)/i.test(category)) return 'USD';
  return 'CNY';
}

function normalizeRecords(input: unknown[], rate: number): IAssetRecord[] {
  if (!Array.isArray(input)) return [];
  const now = Date.now();
  return input
    .map((item, idx) => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      const name = typeof r.name === 'string' ? r.name : `资产${idx + 1}`;
      const category = typeof r.category === 'string' ? r.category : '其他';
      const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount) || 0;
      const currency = resolveCurrency(r);
      const date = typeof r.date === 'string' && r.date ? r.date : new Date().toISOString().slice(0, 10);
      return {
        id: typeof r.id === 'string' ? r.id : genId(),
        name,
        category,
        amount,
        currency,
        // 人民币金额始终按「金额 × 币种汇率」重算，不信任文件中可能过时的 amountCNY
        amountCNY: computeAmountCNY(amount, currency, rate),
        date,
        createdAt: typeof r.createdAt === 'number' ? r.createdAt : now,
        source: (r.source as 'user' | 'mock') ?? 'user',
      } as IAssetRecord;
    })
    .filter((r): r is IAssetRecord => r !== null);
}

/** 校验导入的 icon 是否为合法的 IPhysicalIcon 结构 */
function isPhysicalIcon(value: unknown): value is IPhysicalIcon {
  if (!value || typeof value !== 'object') return false;
  const v = value as { type?: unknown; presetKey?: unknown; imageData?: unknown };
  if (v.type === 'preset') return typeof v.presetKey === 'string';
  if (v.type === 'image') return typeof v.imageData === 'string';
  return false;
}

function normalizePhysicalItems(input: unknown[]): IPhysicalItem[] {
  if (!Array.isArray(input)) return [];
  const now = Date.now();
  return input
    .map((item, idx) => {
      if (!item || typeof item !== 'object') return null;
      const p = item as Record<string, unknown>;
      const name = typeof p.name === 'string' ? p.name : `物品${idx + 1}`;
      const price = typeof p.price === 'number' ? p.price : Number(p.price) || 0;
      const purchaseDate = typeof p.purchaseDate === 'string' && p.purchaseDate ? p.purchaseDate : new Date().toISOString().slice(0, 10);
      // 精简 JSON / 旧账本可能没有 icon 字段：优先用合法 icon，否则按名称推断兜底
      const icon = isPhysicalIcon(p.icon) ? p.icon : inferIconFromName(name);
      return {
        id: typeof p.id === 'string' ? p.id : genId(),
        name,
        price,
        purchaseDate,
        icon,
        createdAt: typeof p.createdAt === 'number' ? p.createdAt : now,
      } as IPhysicalItem;
    })
    .filter((p): p is IPhysicalItem => p !== null);
}

/**
 * 将内部完整数据转换为精简导出格式：
 * - 输出 records 和 physical_items
 * - records 不含 currency 字段（默认人民币）
 * - id / amountCNY / createdAt / source / version / 汇率 等自动生成，不写入 JSON
 * - physical_items 保留 icon 字段（若用户设置了图标），保证导出再导入后图标不丢失
 */
function toExportFormat(data: AppData): {
  physical_items: Array<{ name: string; price: number; purchaseDate: string; icon?: IPhysicalIcon }>;
  records: Array<{ name: string; category: string; amount: number; currency?: 'USD'; date: string }>;
  recordline: IRecordLineEntry[];
} {
  return {
    physical_items: data.physical_items.map((p) => ({
      name: p.name,
      price: p.price,
      purchaseDate: p.purchaseDate,
      ...(p.icon ? { icon: p.icon } : {}),
    })),
    records: data.asset_records.map((r) => ({
      name: r.name,
      category: r.category,
      amount: r.amount,
      // 币种默认人民币（省略）；非人民币记录显式写入 JSON 提示，便于再导入时正确换算
      ...(r.currency === 'USD' ? { currency: 'USD' as const } : {}),
      date: r.date,
    })),
    recordline: data.recordline,
  };
}

/* ============ IndexedDB 账本存储 ============ */

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      const tx = req.transaction!;

      // 清理旧版本 store
      if (db.objectStoreNames.contains('dir-handles')) {
        db.deleteObjectStore('dir-handles');
      }

      // 创建 ledgers store
      if (!db.objectStoreNames.contains(LEDGER_STORE)) {
        db.createObjectStore(LEDGER_STORE, { keyPath: 'id' });
      }

      // 从旧版 file-handles store 迁移数据
      if (db.objectStoreNames.contains('file-handles')) {
        const oldStore = tx.objectStore('file-handles');
        const getReq = oldStore.get('asset-data-file');
        getReq.onsuccess = () => {
          const oldHandle = getReq.result as FileSystemFileHandleLike | undefined;
          if (oldHandle) {
            const ledgersStore = tx.objectStore(LEDGER_STORE);
            const defaultLedger: ILedgerEntry = {
              id: 'default',
              name: '默认账本',
              fileName: oldHandle.name || 'asset-data.json',
              handle: oldHandle,
              createdAt: Date.now(),
              lastOpenedAt: Date.now(),
            };
            ledgersStore.put(defaultLedger);
            localStorage.setItem(ACTIVE_LEDGER_KEY, 'default');
          }
          db.deleteObjectStore('file-handles');
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAllLedgers(): Promise<ILedgerEntry[]> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEDGER_STORE, 'readonly');
    const req = tx.objectStore(LEDGER_STORE).getAll();
    req.onsuccess = () => resolve((req.result as ILedgerEntry[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetLedger(id: string): Promise<ILedgerEntry | null> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEDGER_STORE, 'readonly');
    const req = tx.objectStore(LEDGER_STORE).get(id);
    req.onsuccess = () => resolve((req.result as ILedgerEntry) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutLedger(entry: ILedgerEntry): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEDGER_STORE, 'readwrite');
    tx.objectStore(LEDGER_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDeleteLedger(id: string): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEDGER_STORE, 'readwrite');
    tx.objectStore(LEDGER_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function toMeta(entry: ILedgerEntry): ILedgerMeta {
  const { handle: _handle, ...meta } = entry;
  return meta;
}

/* ============ 核心存储类 ============ */

const FILE_TYPES = [{ description: 'JSON 数据文件', accept: { 'application/json': ['.json'] } }];

class LocalFileStore {
  private fileHandle: FileSystemFileHandleLike | null = null;
  private data: AppData = createEmptyData();
  private ready = false;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  /** 是否有未保存到文件的改动（用于「保存」按钮提示） */
  private dirty = false;
  private listeners = new Set<() => void>();
  private activeLedgerId: string | null = null;
  private activeLedgerMeta: ILedgerMeta | null = null;

  static isSupported(): boolean {
    const w = window as WindowWithFS;
    return typeof window !== 'undefined' && typeof w.showOpenFilePicker === 'function';
  }

  isSupported(): boolean {
    return LocalFileStore.isSupported();
  }

  isReady(): boolean {
    return this.ready;
  }

  getFileName(): string {
    return this.fileHandle?.name ?? '';
  }

  getActiveLedger(): ILedgerMeta | null {
    return this.activeLedgerMeta;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  /* ---------- 账本列表 ---------- */

  async listLedgers(): Promise<ILedgerMeta[]> {
    const entries = await idbGetAllLedgers();
    return entries
      .map(toMeta)
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  }

  /* ---------- 自动加载（启动时恢复活跃账本） ---------- */

  async autoLoad(): Promise<boolean> {
    if (!LocalFileStore.isSupported()) {
      // 非 Chrome：无法读文件，直接用本地快照（下载保存仍可用）
      return this.tryRestoreLastSnapshot();
    }
    try {
      const activeId = localStorage.getItem(ACTIVE_LEDGER_KEY);
      if (!activeId) return this.tryRestoreLastSnapshot();
      const ledger = await idbGetLedger(activeId);
      if (!ledger) return this.tryRestoreLastSnapshot();
      if (ledger.handle?.requestPermission) {
        const permission = await ledger.handle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') return this.tryRestoreLastSnapshot();
      }
      await this.activateLedger(ledger);
      return true;
    } catch {
      return this.tryRestoreLastSnapshot();
    }
  }

  /* ---------- 激活一个账本（加载文件到内存） ---------- */

  private async activateLedger(ledger: ILedgerEntry): Promise<void> {
    this.fileHandle = ledger.handle;
    this.activeLedgerId = ledger.id;
    this.activeLedgerMeta = toMeta(ledger);
    await this.loadFromFile();
    // 更新最后打开时间
    ledger.lastOpenedAt = Date.now();
    this.activeLedgerMeta.lastOpenedAt = ledger.lastOpenedAt;
    await idbPutLedger(ledger);
    localStorage.setItem(ACTIVE_LEDGER_KEY, ledger.id);
    this.ready = true;
    this.notify();
  }

  /** 快照兜底：恢复最近使用账本的本地数据（无句柄也能用） */
  private async tryRestoreLastSnapshot(): Promise<boolean> {
    try {
      const activeId = localStorage.getItem(ACTIVE_LEDGER_KEY);
      const entries = await idbGetAllLedgers();
      const sorted = entries.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
      let target = sorted.find((l) => l.id === activeId) ?? sorted[0];
      if (!target) {
        // 连账本记录都没有：尝试默认快照键
        const raw = localStorage.getItem(SNAPSHOT_KEY_PREFIX + 'default');
        if (!raw) return false;
        target = {
          id: 'default',
          name: '上次数据',
          fileName: '',
          createdAt: Date.now(),
          lastOpenedAt: Date.now(),
        };
        await idbPutLedger(target);
        localStorage.setItem(ACTIVE_LEDGER_KEY, 'default');
      }
      await this.activateLedger(target);
      return true;
    } catch {
      return false;
    }
  }

  /* ---------- 切换账本 ---------- */

  async switchLedger(id: string): Promise<void> {
    const ledger = await idbGetLedger(id);
    if (!ledger) throw new Error('账本不存在');
    if (ledger.handle?.requestPermission) {
      const permission = await ledger.handle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') throw new Error('文件权限被拒绝');
    }
    await this.activateLedger(ledger);
  }

  /* ---------- 新建账本（创建新 JSON 文件） ---------- */

  async createLedger(name?: string): Promise<void> {
    // 新建账本不再选文件/写文件：数据存本地快照，保存时下载 JSON 副本（避免 crswap）
    const ledger: ILedgerEntry = {
      id: genId(),
      name: name?.trim() || '新账本',
      fileName: '',
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
    };
    this.fileHandle = null;
    this.activeLedgerId = ledger.id;
    this.activeLedgerMeta = toMeta(ledger);
    this.data = createEmptyData();
    this.data.asset_exchange_rate = this.loadSavedRate();
    await idbPutLedger(ledger);
    localStorage.setItem(ACTIVE_LEDGER_KEY, ledger.id);
    this.dirty = false;
    this.ready = true;
    this.saveSnapshotNow();
    this.notify();
  }

  /* ---------- 打开已有账本文件 ---------- */

  async openLedgerFile(): Promise<void> {
    const w = window as WindowWithFS;
    if (!w.showOpenFilePicker) throw new Error('浏览器不支持，请使用 Chrome');
    const [handle] = await w.showOpenFilePicker({ multiple: false, types: FILE_TYPES });

    // 检查是否已存在相同文件（通过 name 简单判断，FileSystemHandle 有 isSameEntry 但类型不全）
    const existing = await idbGetAllLedgers();
    let ledger = existing.find((l) => l.fileName === handle.name);

    if (!ledger) {
      ledger = {
        id: genId(),
        name: handle.name.replace(/\.json$/i, '') || '导入的账本',
        fileName: handle.name,
        handle,
        createdAt: Date.now(),
        lastOpenedAt: Date.now(),
      };
      await idbPutLedger(ledger);
    } else {
      // 更新句柄（可能重新选择了同路径文件）
      ledger.handle = handle;
      ledger.lastOpenedAt = Date.now();
      await idbPutLedger(ledger);
    }

    await this.activateLedger(ledger);
  }

  /* ---------- 重命名账本 ---------- */

  async renameLedger(id: string, name: string): Promise<void> {
    const ledger = await idbGetLedger(id);
    if (!ledger) throw new Error('账本不存在');
    ledger.name = name.trim() || ledger.name;
    await idbPutLedger(ledger);
    if (this.activeLedgerId === id) {
      this.activeLedgerMeta = toMeta(ledger);
    }
    this.notify();
  }

  /* ---------- 删除账本 ---------- */

  async deleteLedger(id: string): Promise<void> {
    await idbDeleteLedger(id);
    if (this.activeLedgerId === id) {
      // 切换到另一个账本，或重置为未就绪
      const remaining = await idbGetAllLedgers();
      if (remaining.length > 0) {
        const next = remaining.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0];
        if (next.handle?.requestPermission) {
          try {
            const permission = await next.handle.requestPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
              await this.activateLedger(next);
              return;
            }
          } catch {
            // 权限失败，继续走重置逻辑
          }
        } else {
          await this.activateLedger(next);
          return;
        }
      }
      // 没有其他账本，重置
      this.fileHandle = null;
      this.data = createEmptyData();
      this.activeLedgerId = null;
      this.activeLedgerMeta = null;
      this.ready = false;
      localStorage.removeItem(ACTIVE_LEDGER_KEY);
      this.notify();
    }
  }

  /* ---------- 文件读写 ---------- */

  private async loadFromFile(): Promise<void> {
    if (!this.fileHandle) {
      // 无句柄的账本（新建/快照恢复）：直接从本地快照读取
      if (!this.restoreSnapshot()) this.data = createEmptyData();
      this.data.asset_exchange_rate = this.loadSavedRate();
      return;
    }
    try {
      const file = await this.fileHandle.getFile();
      const text = await file.text();
      if (!text.trim()) {
        if (!this.restoreSnapshot()) this.data = createEmptyData();
      } else {
        // parseImportJSON 同时兼容内部格式和用户精简格式（records → asset_records）
        this.data = parseImportJSON(text, DEFAULT_RATE.rate);
      }
      // 汇率不写入 JSON 文件，按账本存在 localStorage
      this.data.asset_exchange_rate = this.loadSavedRate();
    } catch {
      if (!this.restoreSnapshot()) this.data = createEmptyData();
      this.data.asset_exchange_rate = this.loadSavedRate();
    }
  }

  private loadSavedRate(): IExchangeRate {
    try {
      const raw = localStorage.getItem(RATE_KEY_PREFIX + (this.activeLedgerId || 'default'));
      if (raw) {
        const parsed = JSON.parse(raw) as IExchangeRate;
        if (typeof parsed.rate === 'number') return parsed;
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_RATE, updatedAt: Date.now() };
  }

  private saveRate(rate: IExchangeRate): void {
    try {
      localStorage.setItem(RATE_KEY_PREFIX + (this.activeLedgerId || 'default'), JSON.stringify(rate));
    } catch {
      // ignore
    }
  }

  /* ---------- 本地快照兜底（不再原地写文件，彻底避免 crswap） ---------- */

  private snapshotKey(): string {
    return SNAPSHOT_KEY_PREFIX + (this.activeLedgerId || 'default');
  }

  private saveSnapshotNow(): void {
    try {
      localStorage.setItem(this.snapshotKey(), JSON.stringify(this.data));
    } catch {
      // localStorage 满/隐私模式等异常忽略
    }
  }

  private scheduleSnapshot(): void {
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = setTimeout(() => this.persist(), 300);
  }

  /**
   * 持久化：
   * 1. 先写本地快照（localStorage）作为兜底，刷新不丢数据
   * 2. 若当前账本有可写的文件句柄，将数据自动写回原 JSON 文件（新增/修改/删除后即保存）
   *    写回使用导出格式，与用户手动下载的文件结构一致
   */
  private async persist(): Promise<void> {
    this.saveSnapshotNow();
    if (!this.fileHandle || typeof this.fileHandle.createWritable !== 'function') {
      return;
    }
    try {
      const writable = await this.fileHandle.createWritable();
      await writable.write(JSON.stringify(toExportFormat(this.data), null, 2));
      await writable.close();
      this.dirty = false;
    } catch (err) {
      // 写回文件失败（权限不足/句柄失效等）时保留本地快照，不中断使用
      console.warn('自动保存到 JSON 文件失败，已保留本地快照', err);
    }
  }

  /** 从当前账本的本地快照恢复数据；成功返回 true */
  private restoreSnapshot(): boolean {
    try {
      const raw = localStorage.getItem(this.snapshotKey());
      if (!raw) return false;
      const parsed = JSON.parse(raw) as AppData;
      if (!parsed || typeof parsed !== 'object') return false;
      this.data = { ...createEmptyData(), ...parsed };
      this.data.asset_exchange_rate = this.loadSavedRate();
      return true;
    } catch {
      return false;
    }
  }

  /** 是否有未保存到文件的改动 */
  isDirty(): boolean {
    return this.dirty;
  }

  /* ---------- 数据读写 ---------- */

  get<T>(key: DataKey): T {
    return this.data[key] as unknown as T;
  }

  set(key: DataKey, value: unknown): void {
    (this.data as unknown as Record<string, unknown>)[key] = value;
    // 汇率不写入 JSON 文件，单独存 localStorage
    if (key === 'asset_exchange_rate') {
      this.saveRate(value as IExchangeRate);
    }
    this.dirty = true;
    this.notify();
    if (this.ready) {
      this.scheduleSnapshot();
    }
  }

  /* ---------- 导入 / 导出 ---------- */

  importFromJSONText(text: string): void {
    const imported = parseImportJSON(text, this.data.asset_exchange_rate.rate);
    this.data = imported;
    this.dirty = true;
    this.notify();
    if (this.ready) {
      this.scheduleSnapshot();
    }
  }

  /** 保存：下载 JSON 副本（走下载管理器，不产生 crswap）。返回文件名 */
  exportToDownload(): string {
    const exported = toExportFormat(this.data);
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const fileName = `${this.activeLedgerMeta?.name || 'asset-data'}-${stamp}.json`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.dirty = false;
    this.notify();
    return fileName;
  }

  reset(): void {
    this.data = createEmptyData();
    this.dirty = true;
    this.notify();
    if (this.ready) this.scheduleSnapshot();
  }
}

export const localFileStore = new LocalFileStore();
