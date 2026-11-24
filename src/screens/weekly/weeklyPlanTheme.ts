/**
 * Weekly Plan Design Tokens and Deterministic Subject Pastel Generator
 * 100% Aligned with Web LMS (weekly-plan-client.tsx & sec-hs-theme.ts)
 */

export const SEC_HS = {
  navy: '#1B2D4F',
  border: '#E5E0D8',
  white: '#FFFFFF',
  text: '#1C1917',
  muted: '#78716C',
  warm: '#F7F3EC',
  cream: '#FAFAF8',
} as const;

export const SUBJECT_PASTELS = [
  { bg: '#E6F4F7', text: '#1A5F6E' }, // teal
  { bg: '#E8F0FE', text: '#1E4A8C' }, // blue
  { bg: '#FFF0E0', text: '#9A5B1A' }, // orange
  { bg: '#E3F5EC', text: '#1E5C3A' }, // green
  { bg: '#EEEAFF', text: '#4A3F8A' }, // lavender
  { bg: '#FCE8F0', text: '#9A3A52' }, // coral
  { bg: '#FEF6DC', text: '#8B6020' }, // amber
  { bg: '#F0EDE8', text: '#5C5346' }, // warm gray
] as const;

export function hashSubject(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function subjectPastel(subjectName: string): { bg: string; text: string } {
  return SUBJECT_PASTELS[hashSubject(subjectName || 'Other') % SUBJECT_PASTELS.length];
}

/** Formats string time values to HH:MM */
export function formatTime(t?: string | null): string {
  if (!t) return '—';
  const s = String(t);
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s.slice(0, 5);
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export function timeSlotLabel(start?: string | null, end?: string | null): string {
  const s = formatTime(start);
  const e = formatTime(end);
  return e && e !== '—' && e !== s ? `${s} – ${e}` : s;
}

export function getMondayOfWeek(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dayStr = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const nextY = date.getFullYear();
  const nextM = String(date.getMonth() + 1).padStart(2, '0');
  const nextD = String(date.getDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
}

export function formatWeekRangeLabel(weekStartStr: string): string {
  const weekEndStr = addDays(weekStartStr, 4);
  const [sy, sm, sd] = weekStartStr.split('-').map(Number);
  const [ey, em, ed] = weekEndStr.split('-').map(Number);

  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);

  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const startMonth = startDate.toLocaleDateString('en-GB', { month: 'long' });
  const endMonth = endDate.toLocaleDateString('en-GB', { month: 'long' });
  const year = endDate.getFullYear();

  // Use non-breaking space (\u00A0) between day and month so day + month stay glued together when wrapping
  if (startMonth === endMonth) {
    return `${startDay}\u00A0${startMonth} – ${endDay}\u00A0${startMonth} ${year}`;
  }
  return `${startDay}\u00A0${startMonth} – ${endDay}\u00A0${endMonth} ${year}`;
}
