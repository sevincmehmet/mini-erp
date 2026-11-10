// preload.cjs içinde açılan `window.api` köprüsünün tipleri.

export type IpcResult<T = object> =
  | ({ ok: true; canceled?: false } & T)
  | { ok: true; canceled: true }
  | { ok: false; error: string }

export interface BackupPayload {
  schemaVersion: number
  exportedAt: string
  company: { id: string; name: string; currency: string }
  employees: unknown[]
  shiftTemplates: unknown[]
  shiftAssignments: unknown[]
  timeEntries: unknown[]
  payrolls: unknown[]
  financeCategories: unknown[]
  transactions: unknown[]
}

export interface BackupMeta {
  app: 'MiniErp'
  schemaVersion: number
  createdAt: string
}

export type CellValue = string | number | boolean | null
export type ColumnType = 'text' | 'money' | 'number' | 'date'

export interface ParsedSheet {
  name: string
  rows: CellValue[][]
  truncated: boolean
}

export interface TableExport {
  fileName: string
  sheetName?: string
  columns: { header: string; type?: ColumnType; total?: boolean }[]
  rows: CellValue[][]
}

export interface TemplateExport {
  fileName: string
  sheetName?: string
  columns: { header: string; type?: ColumnType; required?: boolean; help?: string }[]
  examples: CellValue[][]
}

export interface ElectronApi {
  backup: {
    saveJson(payload: BackupPayload): Promise<IpcResult<{ filePath: string }>>
    quickSave(payload: BackupPayload): Promise<IpcResult<{ filePath: string }>>
    openJson(): Promise<IpcResult<{ filePath: string; meta: BackupMeta; data: BackupPayload }>>
    revealFolder(): Promise<IpcResult>
    list(companyName: string): Promise<IpcResult<{ items: { fileName: string; filePath: string; size: number; modifiedAt: string }[] }>>
    prune(payload: { companyName: string; keep: number }): Promise<IpcResult<{ removed: number }>>
    read(filePath: string): Promise<IpcResult<{ filePath: string; meta: BackupMeta; data: BackupPayload }>>
  }
  excel: {
    export(payload: BackupPayload): Promise<IpcResult<{ filePath: string }>>
    exportTable(payload: TableExport): Promise<IpcResult<{ filePath: string }>>
    saveTemplate(payload: TemplateExport): Promise<IpcResult<{ filePath: string }>>
    parse(payload: { name: string; bytes: ArrayBuffer }): Promise<IpcResult<{ sheets: ParsedSheet[] }>>
    readWatched(filePath: string): Promise<IpcResult<{ sheets: ParsedSheet[] }>>
  }
  pathForFile(file: File): string | null
  watch: {
    set(paths: string[]): Promise<IpcResult<{ watching: string[] }>>
    onChanged(callback: (path: string) => void): () => void
  }
  secure: {
    get(): Promise<IpcResult<{ value: string | null }>>
    set(value: string): Promise<IpcResult>
    clear(): Promise<IpcResult>
  }
  pdf: {
    exportPage(payload: { title: string; landscape?: boolean }): Promise<IpcResult<{ filePath: string }>>
  }
  setTheme(theme: 'system' | 'light' | 'dark'): Promise<void>
  platform: string
  /** Sunucusuz demo sürüm: API uygulamanın içinde, yerel SQLite ile çalışır */
  demo?: {
    enabled: boolean
    apiUrl: string | null
    reset(): Promise<IpcResult>
  }
}

declare global {
  interface Window {
    /** Yalnızca Electron içinde tanımlıdır; tarayıcıda çalışırken undefined olur. */
    api?: ElectronApi
  }
}
