/**
 * Official Literacy Domain Constants & Pure Helper Functions
 * Aligned with Web LMS (lib/constants/literacy-prompts.ts)
 */

export interface LiteracyReadingType {
  id: string;
  label: string;
  color: string;
}

export const LITERACY_READING_TYPES: LiteracyReadingType[] = [
  { id: 'novel', label: 'Novel / Fiction', color: '#1A5F6E' },
  { id: 'nonfic', label: 'Non-Fiction / Memoir', color: '#1B2D4F' },
  { id: 'article', label: 'Article / Essay', color: '#B8842A' },
  { id: 'journal', label: 'Academic Journal', color: '#6B5EA8' },
  { id: 'news', label: 'News / Current Affairs', color: '#C0506A' },
  { id: 'poetry', label: 'Poetry / Literature', color: '#2E7D52' },
  { id: 'graphic', label: 'Graphic Novel / Comic', color: '#2A7F91' },
  { id: 'other', label: 'Other', color: '#78716C' },
];

export const LITERACY_TYPES: string[] = LITERACY_READING_TYPES.map((t) => t.label);

export const LITERACY_LANGUAGES = [
  'English',
  'Bahasa Indonesia',
  'Arabic',
  'Other',
];

export const LITERACY_GENRES = [
  'Historical Fiction',
  'Science Fiction',
  'Fantasy',
  'Dystopia',
  'Mystery / Thriller',
  'Romance',
  'Adventure',
  'Biography',
  'Science / Nature',
  'Philosophy',
  'Politics / Society',
  'Religion / Spirituality',
  'Self-development',
  'Arts & Culture',
  'Technology',
  'Health & Medicine',
  'Economics',
  'Other',
];

export const LITERACY_RATINGS = [
  'Outstanding ★★★★★',
  'Very good ★★★★',
  'Good ★★★',
  'Fair ★★',
  'Weak ★',
];

export const LITERACY_PROMPTS_BY_TRACK = {
  smp: {
    claim: [
      'What is the main idea or message of this text?',
      'What did the author want you to think or feel?',
      'What is the most important thing you learned?',
    ],
    evidence: [
      'Which part of the text shows this most clearly?',
      'What specific moment or sentence supports your answer?',
      'Give one example from the text that proves your point.',
    ],
    sowhat: [
      'How does this connect to your life or the world around you?',
      'Did this change how you think about something? How?',
      'Why does this text matter — who should read it and why?',
    ],
  },
  sma: {
    claim: [
      'What argument or central claim does the author make?',
      'What perspective or worldview does this text represent?',
      "What assumption underlies this text's main idea?",
    ],
    evidence: [
      'Which specific passage, data, or example best supports your claim?',
      'What textual evidence challenges or complicates your claim?',
      'How does the author use language or structure to support this?',
    ],
    sowhat: [
      'What are the broader implications of the author\'s argument?',
      'How does this connect to other texts, ideas, or global issues?',
      'What question does this text leave unanswered — and why does that matter?',
    ],
  },
};

export const LITERACY_CLAIM_PROMPTS = LITERACY_PROMPTS_BY_TRACK.sma.claim;
export const LITERACY_EVIDENCE_PROMPTS = LITERACY_PROMPTS_BY_TRACK.sma.evidence;
export const LITERACY_SO_WHAT_PROMPTS = LITERACY_PROMPTS_BY_TRACK.sma.sowhat;

/** Term targets: SMP ≥12 texts / ≥4 genres; SMA ≥18 / ≥5; English ≥30% both */
export function getCurriculumTargets(track?: string | null): {
  texts: number;
  genres: number;
  englishPct: number;
} {
  const norm = (track || '').toLowerCase();
  if (norm.includes('sma') || norm.includes('high') || norm.includes('alevel') || norm.includes('igcse')) {
    return { texts: 18, genres: 5, englishPct: 30 };
  }
  return { texts: 12, genres: 4, englishPct: 30 };
}

export function getReadingTypeLabel(idOrLabel?: string | null): string {
  if (!idOrLabel) return 'Novel / Fiction';
  const trimmed = idOrLabel.trim();
  const found = LITERACY_READING_TYPES.find(
    (t) => t.id.toLowerCase() === trimmed.toLowerCase() || t.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (found) return found.label;

  const lower = trimmed.toLowerCase();
  if (lower.includes('nonfic') || lower.includes('memoir')) return 'Non-Fiction / Memoir';
  if (lower.includes('article') || lower.includes('essay')) return 'Article / Essay';
  if (lower.includes('journal')) return 'Academic Journal';
  if (lower.includes('news')) return 'News / Current Affairs';
  if (lower.includes('poetry') || lower.includes('literature')) return 'Poetry / Literature';
  if (lower.includes('graphic') || lower.includes('comic')) return 'Graphic Novel / Comic';
  if (lower.includes('novel') || lower.includes('fiction')) return 'Novel / Fiction';
  return 'Other';
}

export function getReadingTypeId(idOrLabel?: string | null): string {
  if (!idOrLabel) return 'novel';
  const trimmed = idOrLabel.trim();
  const found = LITERACY_READING_TYPES.find(
    (t) => t.id.toLowerCase() === trimmed.toLowerCase() || t.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (found) return found.id;

  const lower = trimmed.toLowerCase();
  if (lower.includes('nonfic') || lower.includes('memoir')) return 'nonfic';
  if (lower.includes('article') || lower.includes('essay')) return 'article';
  if (lower.includes('journal')) return 'journal';
  if (lower.includes('news')) return 'news';
  if (lower.includes('poetry') || lower.includes('literature')) return 'poetry';
  if (lower.includes('graphic') || lower.includes('comic')) return 'graphic';
  if (lower.includes('novel') || lower.includes('fiction')) return 'novel';
  return 'other';
}

export function getReadingTypeColor(idOrLabel?: string | null): string {
  if (!idOrLabel) return '#1A5F6E';
  const trimmed = idOrLabel.trim();
  const found = LITERACY_READING_TYPES.find(
    (t) => t.id.toLowerCase() === trimmed.toLowerCase() || t.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (found) return found.color;

  const lower = trimmed.toLowerCase();
  if (lower.includes('nonfic') || lower.includes('memoir')) return '#1B2D4F';
  if (lower.includes('article') || lower.includes('essay')) return '#B8842A';
  if (lower.includes('journal')) return '#6B5EA8';
  if (lower.includes('news')) return '#C0506A';
  if (lower.includes('poetry') || lower.includes('literature')) return '#2E7D52';
  if (lower.includes('graphic') || lower.includes('comic')) return '#2A7F91';
  if (lower.includes('other')) return '#78716C';
  return '#1A5F6E';
}

export function getReadingTypeTheme(idOrLabel?: string | null) {
  const color = getReadingTypeColor(idOrLabel);
  return {
    color,
    bg: `${color}18`,
    border: `${color}30`,
  };
}

export function getRatingLabel(val?: number | string | null): string {
  if (val == null || val === '' || val === 0) return '';
  if (typeof val === 'number') {
    switch (Math.round(val)) {
      case 5: return 'Outstanding ★★★★★';
      case 4: return 'Very good ★★★★';
      case 3: return 'Good ★★★';
      case 2: return 'Fair ★★';
      case 1: return 'Weak ★';
      default: return 'Outstanding ★★★★★';
    }
  }
  const str = String(val).trim();
  if (!str) return '';
  if (str === '5') return 'Outstanding ★★★★★';
  if (str === '4') return 'Very good ★★★★';
  if (str === '3') return 'Good ★★★';
  if (str === '2') return 'Fair ★★';
  if (str === '1') return 'Weak ★';

  const starCount = (str.match(/[★⭐]/g) || []).length;
  if (starCount >= 1 && starCount <= 5) {
    return getRatingLabel(starCount);
  }
  const parsedNum = parseInt(str, 10);
  if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 5) {
    return getRatingLabel(parsedNum);
  }
  return '';
}

export function getRatingScore(labelOrVal?: number | string | null): number | null {
  if (labelOrVal == null || labelOrVal === '' || labelOrVal === 0) return null;
  if (typeof labelOrVal === 'number') {
    return Math.max(1, Math.min(5, Math.round(labelOrVal)));
  }
  const str = String(labelOrVal).trim();
  if (!str) return null;
  const stars = (str.match(/[★⭐]/g) || []).length;
  if (stars >= 1 && stars <= 5) return stars;
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 1 && num <= 5) return num;
  return null;
}
