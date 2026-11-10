import { Button } from '../ui/Glass'
import { Icon, type IconName } from '../ui/Icons'

export function EmptyHint({ onAdd, onImport, icon = 'sparkles', title = 'Henüz kayıt yok' }: { onAdd: () => void; onImport: () => void; icon?: IconName; title?: string }) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <span className="grid size-12 place-items-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon name={icon} size={22} /></span>
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-[var(--text-muted)]">Tek tek ekleyebilir ya da mevcut Excel dosyanızı bu sayfaya sürükleyip bırakabilirsiniz.</p>
      <div className="mt-5 flex justify-center gap-2">
        <Button variant="secondary" icon="upload" onClick={onImport}>Excel'den Aktar</Button>
        <Button icon="plus" onClick={onAdd}>Yeni Ekle</Button>
      </div>
    </div>
  )
}
