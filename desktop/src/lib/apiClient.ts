import { useCompanyStore } from '../stores/useCompanyStore'
import { session } from './session'

export class ApiError extends Error {
  constructor(public status: number, message: string, public errors: string[] = []) {
    super(message)
  }
}

/** Tüm API çağrıları buradan geçer: aktif şirket header'ı otomatik eklenir. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const companyId = useCompanyStore.getState().activeCompanyId
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (companyId && !headers.has('X-Company-Id') && !path.startsWith('/api/auth/') && !path.startsWith('/api/companies') && !path.startsWith('/api/consolidated') && !path.startsWith('/api/notifications')) headers.set('X-Company-Id', companyId)
  if (session.token) headers.set('Authorization', `Bearer ${session.token}`)

  let res: Response
  try {
    res = await fetch(`${session.server}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Sunucuya ulaşılamadı. İnternet bağlantısını ve sunucu adresini kontrol edin.')
  }
  // Oturum süresi dolduysa ya da başka cihazda şifre değiştiyse giriş ekranına dön
  if (res.status === 401 && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/setup')) {
    session.unauthorized()
    throw new ApiError(401, 'Oturumunuz sona erdi; lütfen tekrar giriş yapın.')
  }
  if (!res.ok) {
    const problem = await res.json().catch(() => null)
    const message =
      res.status === 404 ? 'Kayıt bulunamadı (silinmiş olabilir).'
      : problem?.title ?? problem?.detail ?? res.statusText
    throw new ApiError(res.status, message, Array.isArray(problem?.errors) ? problem.errors : [])
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

type Method = 'POST' | 'PUT' | 'DELETE'

export function send<T = void>(method: Method, path: string, body?: unknown): Promise<T> {
  return api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
}

/** Dosya indirme (ek, rapor): yetki başlığıyla birlikte ham yanıt. */
export async function download(path: string): Promise<Blob> {
  const headers = new Headers()
  const companyId = useCompanyStore.getState().activeCompanyId
  if (companyId) headers.set('X-Company-Id', companyId)
  if (session.token) headers.set('Authorization', `Bearer ${session.token}`)
  const res = await fetch(`${session.server}${path}`, { headers })
  if (!res.ok) throw new ApiError(res.status, 'Dosya indirilemedi.')
  return res.blob()
}

/** Çok parçalı form yükleme (dosya ekleri). */
export function upload<T>(path: string, form: FormData): Promise<T> {
  return api<T>(path, { method: 'POST', body: form })
}

export function errorMessage(err: unknown) {
  if (err instanceof ApiError && err.errors.length > 1) return err.errors.join(' ')
  return err instanceof Error ? err.message : 'Bilinmeyen hata'
}
