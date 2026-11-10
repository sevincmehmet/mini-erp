import type { ReactNode, SVGProps } from 'react'

/**
 * SF Symbols benzeri ince çizgili simge seti. Tüm arayüz simgeleri buradan gelir;
 * renk currentColor'dan alınır, boyut `size` ile verilir.
 */
const PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>,
  employees: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.3 0 4 1.4 4.6 4" /></>,
  shifts: <><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><path d="M12 13v3l2 1" /></>,
  timesheet: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  finance: <><rect x="2.5" y="6" width="19" height="13" rx="3" /><path d="M2.5 10h19" /><path d="M16 15h2" /><path d="M5 6l9.5-3 1.5 3" /></>,
  payroll: <><path d="M6 2.5h9l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4" /><path d="M14.5 2.5v4.5H19" /><path d="M9 12.5h6M9 16.5h4" /></>,
  datasets: <><ellipse cx="12" cy="5.5" rx="7.5" ry="3" /><path d="M4.5 5.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" /><path d="M4.5 11.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" /></>,
  backup: <><path d="M4 7.5h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M3 4h18v3.5H3z" /><path d="M12 11v6M9.5 14.5 12 17l2.5-2.5" /></>,
  calendar: <><rect x="3.5" y="4.5" width="17" height="16" rx="3" /><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" /></>,
  sidebar: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /><path d="M5.5 8h1.5M5.5 11h1.5" /></>,
  gallery: <><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" /><rect x="13" y="3.5" width="7.5" height="7.5" rx="2" /><rect x="3.5" y="13" width="7.5" height="7.5" rx="2" /><path d="M16.75 13.5v6.5M13.5 16.75H20" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  bell: <><path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 1.8 6.5 1.8 6.5H4.2S6 14 6 9.5z" /><path d="M10 19.5a2 2 0 0 0 4 0" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  logout: <><path d="M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15" /></>,
  user: <><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20c1-3.8 4-5.5 7.5-5.5s6.5 1.7 7.5 5.5" /></>,
  buildings: <><rect x="3.5" y="7" width="8" height="13.5" rx="1.5" /><path d="M11.5 10.5h7.5a1.5 1.5 0 0 1 1.5 1.5v8.5h-9" /><path d="M6.5 10.5h2M6.5 14h2M6.5 17.5h2M14.5 14h2.5M14.5 17.5h2.5" /><path d="M7.5 7V3.5" /></>,
  handshake: <><path d="M3 12.5 7 8.5l3 1.5 2.5-2 3 1 5 3.5" /><path d="M3 12.5l4.5 4 2-1 1.5 1.5 2-1 1.5 1.5 4-3.5" /><path d="M10 10l4 3.5" /></>,
  beach: <><path d="M4 20.5h16" /><path d="M12 20.5 9 9" /><path d="M3.5 9.5c2-5 9-6.5 13-2.5L9 9z" /><circle cx="18" cy="5" r="1.5" /></>,
  history: <><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3.5 4.5V9H8" /><path d="M12 7.5V12l3 2" /></>,
  trashOpen: <><path d="M4 7h16" /><path d="M9.5 7V4.5h5V7" /><path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" /></>,
  paperclip: <path d="m19.5 11.5-7.4 7.4a4.6 4.6 0 0 1-6.5-6.5l7.7-7.7a3 3 0 0 1 4.3 4.3l-7.5 7.5a1.5 1.5 0 0 1-2.1-2.1l6.9-6.9" />,
  printer: <><path d="M7 9V3.5h10V9" /><rect x="3.5" y="9" width="17" height="8" rx="2" /><path d="M7 14.5h10V21H7z" /></>,
  eyeWatch: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><path d="M12 9v3l2 1.5" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8.5-8.5M16.5 6.5l2 2M14.5 8.5l1.5 1.5" /></>,
  server: <><rect x="3.5" y="4" width="17" height="7" rx="2" /><rect x="3.5" y="13" width="17" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  restore: <><path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4.5h4.5" /><path d="M12 8v8M9 13l3 3 3-3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14" /></>,
  download: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14" /></>,
  edit: <><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m14.5 7.5 3 3" /></>,
  trash: <><path d="M4 7h16M9.5 7V4.5h5V7" /><path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" /><path d="M10 11v6M14 11v6" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  columns: <><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M9.5 4v16M14.5 4v16" /></>,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronUpDown: <><path d="m8 9 4-4 4 4" /><path d="m8 15 4 4 4-4" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
  refresh: <><path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5" /><path d="M4 4v4.5h4.5" /><path d="M4 12.5a8 8 0 0 0 13.7 5.2L20 15.5" /><path d="M20 20v-4.5h-4.5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  monitor: <><rect x="2.5" y="4" width="19" height="13" rx="2.5" /><path d="M8.5 21h7M12 17v4" /></>,
  command: <path d="M9 6.5A2.5 2.5 0 1 0 6.5 9H9V6.5zm0 0v11m0-11h6m-6 11A2.5 2.5 0 1 1 6.5 15H9v2.5zm0 0h6m0-11A2.5 2.5 0 1 1 17.5 9H15V6.5zm0 0v11m0 0A2.5 2.5 0 1 0 17.5 15H15v2.5zM9 9h6v6H9z" />,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.7 9.5a2.4 2.4 0 0 1 4.6.9c0 1.6-2.3 2.1-2.3 3.6" /><path d="M12 16.9v.1" /></>,
  sparkles: <><path d="M12 3.5 13.6 8a2 2 0 0 0 1.4 1.4l4.5 1.6-4.5 1.6a2 2 0 0 0-1.4 1.4L12 18.5 10.4 14a2 2 0 0 0-1.4-1.4L4.5 11 9 9.4A2 2 0 0 0 10.4 8z" /><path d="M19 3v3M17.5 4.5h3" /></>,
  trendUp: <><path d="m3.5 16.5 6-6 4 4 7-7" /><path d="M15 7.5h5.5V13" /></>,
  trendDown: <><path d="m3.5 7.5 6 6 4-4 7 7" /><path d="M15 16.5h5.5V11" /></>,
  grip: <><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>,
  copy: <><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" /><path d="M15.5 8.5V6A2 2 0 0 0 13.5 4H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" /></>,
  table: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" /></>,
  chart: <><path d="M4 20V4" /><path d="M4 20h16" /><rect x="7.5" y="11" width="3" height="6" rx="1" /><rect x="12.5" y="7" width="3" height="10" rx="1" /><rect x="17.5" y="13" width="2.5" height="4" rx="1" /></>,
  folder: <path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  save: <><path d="M5 4h11l3.5 3.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>,
  excel: <><path d="M6 2.5h9l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4" /><path d="M14.5 2.5v4.5H19" /><path d="m9 11 5 6M14 11l-5 6" /></>,
  calculator: <><rect x="5" y="2.5" width="14" height="19" rx="2.5" /><path d="M8.5 6.5h7v3h-7zM8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01" /></>,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" /><path d="M20 10h-4a2 2 0 0 0 0 4h4" /></>,
  arrowDownCircle: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8.5 12.5 12 16l3.5-3.5" /></>,
  arrowUpCircle: <><circle cx="12" cy="12" r="9" /><path d="M12 16V8M8.5 11.5 12 8l3.5 3.5" /></>,
  scale: <><path d="M12 4v16M7 20h10M5 7h14" /><path d="m5 7-2.5 6a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5h.01" /></>,
  layout: <><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="M3.5 9h17M10 9v11.5" /></>,
  bolt: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z" />,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z" /><path d="m9 12 2 2 4-4" /></>,
  file: <><path d="M6 2.5h9l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4" /><path d="M14.5 2.5v4.5H19" /></>,
  more: <><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></>,
  undo: <><path d="M9 14 4.5 9.5 9 5" /><path d="M4.5 9.5H15a5 5 0 0 1 0 10h-3" /></>,
  lira: <><path d="M9 3.5v13.5a4 4 0 0 0 4 0" /><path d="M6 10.5 13.5 7M6 14.5l7.5-3.5" /><path d="M9 20.5c5 0 9-3 9-8" /></>,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 16, strokeWidth = 1.7, ...props }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {PATHS[name]}
    </svg>
  )
}

/** Eski kullanım için: kenar çubuğu simgeleri */
export const Icons = {
  dashboard: () => <Icon name="dashboard" size={18} />,
  employees: () => <Icon name="employees" size={18} />,
  shifts: () => <Icon name="shifts" size={18} />,
  timesheet: () => <Icon name="timesheet" size={18} />,
  finance: () => <Icon name="finance" size={18} />,
  payroll: () => <Icon name="payroll" size={18} />,
  datasets: () => <Icon name="datasets" size={18} />,
  backup: () => <Icon name="backup" size={18} />,
}
