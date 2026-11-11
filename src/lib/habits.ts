/**
 * The 16 fixed daily habits. Titles are templates so numeric targets can be
 * adjusted in Settings → Daily Goals; with default targets the rendered titles
 * match the original list exactly.
 */

export type CategoryId = 'fitness' | 'nutrition' | 'study' | 'selfcare';

export interface Category {
  id: CategoryId;
  title: string;
  shortTitle: string;
}

export const CATEGORIES: Category[] = [
  { id: 'fitness', title: 'Fitness', shortTitle: 'Fitness' },
  { id: 'nutrition', title: 'Nutrition', shortTitle: 'Nutrition' },
  { id: 'study', title: 'Study & Research', shortTitle: 'Study' },
  { id: 'selfcare', title: 'Discipline & Self-Care', shortTitle: 'Self-Care' },
];

export interface TargetSpec {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

export interface HabitDefinition {
  id: string;
  category: CategoryId;
  /** Title template; `{0}`, `{1}` are replaced with targets. */
  template: string;
  defaultTargets: number[];
  targetSpecs: TargetSpec[];
  sortOrder: number;
}

export const TOTAL_HABITS = 16;
/** A streak day requires at least 80% of the 16 habits (13 habits). */
export const STREAK_THRESHOLD = Math.ceil(TOTAL_HABITS * 0.8);

const t = (label: string, unit: string, min: number, max: number, step = 1): TargetSpec => ({ label, unit, min, max, step });

export const HABITS: HabitDefinition[] = [
  { id: 'steps', category: 'fitness', template: 'Walk {0} steps', defaultTargets: [10000], targetSpecs: [t('Steps', 'steps', 1000, 50000, 500)], sortOrder: 1 },
  { id: 'jogging', category: 'fitness', template: '{0} minutes jogging', defaultTargets: [30], targetSpecs: [t('Jogging', 'min', 5, 240, 5)], sortOrder: 2 },
  { id: 'strength', category: 'fitness', template: '{0} minutes strength training', defaultTargets: [30], targetSpecs: [t('Strength training', 'min', 5, 240, 5)], sortOrder: 3 },
  { id: 'stretching', category: 'fitness', template: '{0}–{1} minutes stretching', defaultTargets: [5, 10], targetSpecs: [t('Stretching (min)', 'min', 1, 120), t('Stretching (max)', 'min', 1, 120)], sortOrder: 4 },

  { id: 'calories', category: 'nutrition', template: 'Stay within a healthy calorie target', defaultTargets: [], targetSpecs: [], sortOrder: 5 },
  { id: 'protein', category: 'nutrition', template: 'Eat {0} g protein', defaultTargets: [120], targetSpecs: [t('Protein', 'g', 10, 400, 5)], sortOrder: 6 },
  { id: 'cooking', category: 'nutrition', template: '{0} minutes cooking', defaultTargets: [30], targetSpecs: [t('Cooking', 'min', 5, 240, 5)], sortOrder: 7 },
  { id: 'water', category: 'nutrition', template: 'Drink {0}–{1} liters of water', defaultTargets: [2, 3], targetSpecs: [t('Water (min)', 'L', 0.5, 8, 0.5), t('Water (max)', 'L', 0.5, 8, 0.5)], sortOrder: 8 },
  { id: 'vegfruit', category: 'nutrition', template: 'Eat vegetables and fruit', defaultTargets: [], targetSpecs: [], sortOrder: 9 },

  { id: 'study', category: 'study', template: '{0} hours focused study/research', defaultTargets: [10], targetSpecs: [t('Focused study', 'h', 0.5, 16, 0.5)], sortOrder: 10 },
  { id: 'paper', category: 'study', template: 'Read or write an academic paper', defaultTargets: [], targetSpecs: [], sortOrder: 11 },
  { id: 'priorities', category: 'study', template: "Set tomorrow's top {0} priorities", defaultTargets: [3], targetSpecs: [t('Priorities', '', 1, 10)], sortOrder: 12 },

  { id: 'mobile', category: 'selfcare', template: 'Recreational mobile use under {0} minutes', defaultTargets: [30], targetSpecs: [t('Mobile use limit', 'min', 5, 240, 5)], sortOrder: 13 },
  { id: 'minoxidil', category: 'selfcare', template: 'Take prescribed oral minoxidil tablet', defaultTargets: [], targetSpecs: [], sortOrder: 14 },
  { id: 'sleep', category: 'selfcare', template: 'Sleep {0}–{1} hours', defaultTargets: [7, 9], targetSpecs: [t('Sleep (min)', 'h', 4, 12, 0.5), t('Sleep (max)', 'h', 4, 12, 0.5)], sortOrder: 15 },
  { id: 'nophone', category: 'selfcare', template: 'No phone {0} minutes before bed', defaultTargets: [30], targetSpecs: [t('Phone-free time', 'min', 5, 180, 5)], sortOrder: 16 },
];

export const HABIT_IDS = HABITS.map((h) => h.id);
export const HABIT_BY_ID: Record<string, HabitDefinition> = Object.fromEntries(HABITS.map((h) => [h.id, h]));

export function habitsInCategory(category: CategoryId): HabitDefinition[] {
  return HABITS.filter((h) => h.category === category);
}

function formatTarget(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('en-US') : String(n);
}

export function renderHabitTitle(def: HabitDefinition, targets?: number[] | null): string {
  const values = targets && targets.length === def.defaultTargets.length ? targets : def.defaultTargets;
  return def.template.replace(/\{(\d+)\}/g, (_, i) => formatTarget(values[Number(i)] ?? def.defaultTargets[Number(i)]));
}

/** Validate a target array for a habit. Returns an error message or null. */
export function validateTargets(def: HabitDefinition, targets: number[]): string | null {
  if (targets.length !== def.targetSpecs.length) return 'Wrong number of values';
  for (let i = 0; i < targets.length; i++) {
    const v = targets[i];
    const s = def.targetSpecs[i];
    if (!Number.isFinite(v)) return `${s.label}: enter a number`;
    if (v < s.min || v > s.max) return `${s.label}: must be between ${s.min} and ${s.max}`;
  }
  if (targets.length === 2 && targets[0] > targets[1]) return 'Minimum cannot exceed maximum';
  return null;
}
