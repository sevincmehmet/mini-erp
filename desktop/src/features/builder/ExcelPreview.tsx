import { useState } from 'react'
import { cx } from '../../components/ui/Glass'
import { Icon } from '../../components/ui/Icons'
import { parseDate } from '../../lib/format'
import type { CellValue } from '../../types/electron'
import type { SampleColumn } from './samples'

const letter = (i: number) => {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/** Excel'in hücre biçimleriyle aynı görünüm: tarih gg.aa.yyyy, tutar #.##0,00 ₺ */
function excelText(v: CellValue, type: SampleColumn['type']) {
  if (v == null || v === '') return ''
  if (type === 'date') { const d = parseDate(String(v)); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}` }
  if (type === 'money') return `${Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
  if (type === 'number') return Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 2 })
  return String(v)
}

const WIDTH: Record<SampleColumn['type'], number> = { date: 96, money: 128, number: 104, text: 150 }

/**
 * Şablonun Excel'de nasıl görüneceğinin birebir önizlemesi: sütun harfleri, satır numaraları,
 * koyu başlık satırı, biçimli hücreler, formül çubuğu ve sayfa sekmeleri.
 * Elektronik tablo görünümü bilinçli olarak her temada açık renktir.
 */
export function ExcelPreview({ fileName, sheetName, columns, rows, maxRows = 22 }: {
  fileName: string; sheetName: string; columns: SampleColumn[]; rows: CellValue[][]; maxRows?: number
}) {
  const [tab, setTab] = useState<'data' | 'help'>('data')
  const [sel, setSel] = useState<{ r: number; c: number }>({ r: 0, c: 0 })
  const shown = rows.slice(0, maxRows)
  const cellValue = sel.r === 0 ? `${columns[sel.c]?.header}${columns[sel.c]?.required ? ' *' : ''}` : excelText(shown[sel.r - 1]?.[sel.c] ?? null, columns[sel.c]?.type ?? 'text')

  return (
    <div className="overflow-hidden rounded-[12px] border border-[#d4d4d4] bg-white text-[#1f1f1f] shadow-[0_8px_30px_rgba(0,0,0,0.12)]" style={{ fontFamily: 'Calibri, "Segoe UI", -apple-system, system-ui, sans-serif' }}>
      {/* Pencere başlığı */}
      <div className="flex items-center gap-2 bg-[#1e7145] px-3 py-1.5 text-[12px] text-white">
        <span className="flex gap-1.5"><span className="size-2.5 rounded-full bg-white/35" /><span className="size-2.5 rounded-full bg-white/35" /><span className="size-2.5 rounded-full bg-white/35" /></span>
        <Icon name="excel" size={14} className="ml-2" />
        <span className="font-medium">{fileName}</span>
        <span className="ml-auto opacity-70">Önizleme</span>
      </div>
      {/* Formül çubuğu */}
      <div className="flex items-center border-b border-[#d4d4d4] bg-[#f8f8f8] text-[12px]">
        <span className="w-16 border-r border-[#d4d4d4] px-2 py-1 text-center font-medium">{letter(sel.c)}{sel.r + 1}</span>
        <span className="border-r border-[#d4d4d4] px-2 py-1 italic text-[#7a7a7a]">fx</span>
        <span className="truncate px-2 py-1">{cellValue}</span>
      </div>

      {tab === 'data' ? (
        <div className="max-h-[46vh] overflow-auto">
          <table className="border-collapse text-[12px]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 38 }} />
              {columns.map((c) => <col key={c.header} style={{ width: WIDTH[c.type] }} />)}
            </colgroup>
            <thead>
              <tr className="sticky top-0 z-10">
                <th className="sticky left-0 z-20 border border-[#d4d4d4] bg-[#efefef]" />
                {columns.map((c, i) => (
                  <th key={i} className={cx('border border-[#d4d4d4] bg-[#efefef] py-0.5 text-center font-normal text-[#555]', sel.c === i && 'bg-[#d3e5d9] text-[#1e7145]')}>{letter(i)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 1. satır: şablonun başlık satırı (dışa aktarımdaki gibi koyu zemin, beyaz kalın yazı, dondurulmuş) */}
              <tr className="sticky top-[21px] z-10">
                <td className={cx('sticky left-0 z-20 border border-[#d4d4d4] bg-[#efefef] text-center text-[#555]', sel.r === 0 && 'bg-[#d3e5d9] text-[#1e7145]')}>1</td>
                {columns.map((c, i) => (
                  <td key={i} onClick={() => setSel({ r: 0, c: i })}
                    className={cx('h-[24px] cursor-cell truncate border border-[#3a3a3a] bg-[#1d1d1f] px-1.5 font-bold text-white', sel.r === 0 && sel.c === i && 'outline outline-2 -outline-offset-2 outline-[#1e7145]')}>
                    {c.header}{c.required ? ' *' : ''}
                  </td>
                ))}
              </tr>
              {shown.map((row, ri) => (
                <tr key={ri}>
                  <td className={cx('sticky left-0 z-[5] border border-[#d4d4d4] bg-[#efefef] text-center text-[#555]', sel.r === ri + 1 && 'bg-[#d3e5d9] text-[#1e7145]')}>{ri + 2}</td>
                  {columns.map((c, ci) => {
                    const text = excelText(row[ci] ?? null, c.type)
                    return (
                      <td key={ci} onClick={() => setSel({ r: ri + 1, c: ci })}
                        className={cx('h-[22px] cursor-cell truncate border border-[#e1e1e1] px-1.5', c.type !== 'text' && 'text-right tabular-nums',
                          sel.r === ri + 1 && sel.c === ci && 'outline outline-2 -outline-offset-2 outline-[#1e7145]')}>
                        {text}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > shown.length && <p className="px-3 py-2 text-[11.5px] text-[#7a7a7a]">… ve {(rows.length - shown.length).toLocaleString('tr-TR')} satır daha</p>}
        </div>
      ) : (
        <div className="max-h-[46vh] overflow-auto p-0">
          <table className="w-full border-collapse text-[12px]">
            <thead><tr>{['Sütun', 'Zorunlu', 'Tip', 'Açıklama'].map((h) => <th key={h} className="border border-[#3a3a3a] bg-[#1d1d1f] px-2 py-1 text-left font-bold text-white">{h}</th>)}</tr></thead>
            <tbody>
              {columns.map((c) => (
                <tr key={c.header}>
                  <td className="border border-[#e1e1e1] px-2 py-1 font-medium">{c.header}</td>
                  <td className="border border-[#e1e1e1] px-2 py-1">{c.required ? 'Evet' : ''}</td>
                  <td className="border border-[#e1e1e1] px-2 py-1 text-[#555]">{{ date: 'Tarih', money: 'Tutar (₺)', number: 'Sayı', text: 'Metin' }[c.type]}</td>
                  <td className="border border-[#e1e1e1] px-2 py-1 text-[#555]">{c.help}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sayfa sekmeleri */}
      <div className="flex items-center gap-0.5 border-t border-[#d4d4d4] bg-[#f3f3f3] px-2 text-[12px]">
        {([['data', sheetName], ['help', 'Açıklamalar']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cx('-mt-px border-x border-b px-3 py-1', tab === id ? 'border-[#d4d4d4] bg-white font-semibold text-[#1e7145] shadow-[inset_0_2px_0_#1e7145]' : 'border-transparent text-[#555] hover:bg-white/70')}>
            {label}
          </button>
        ))}
        <span className="ml-auto py-1 text-[11px] text-[#7a7a7a]">{rows.length.toLocaleString('tr-TR')} satır · {columns.length} sütun</span>
      </div>
    </div>
  )
}
