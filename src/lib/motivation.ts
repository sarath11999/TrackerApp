import { diffDays, startOfYear, type DateKey } from './date';

const MESSAGES = [
  'Small steps, repeated daily, become big results.',
  'You don’t need a perfect day — just a better one than yesterday.',
  'Discipline is choosing what you want most over what you want now.',
  'Progress is quiet. Keep showing up.',
  'Every checked box is a vote for the person you’re becoming.',
  'Focus on the next right action, not the whole mountain.',
  'Consistency beats intensity.',
  'Your future self is built by today’s routines.',
  'Done is better than perfect. Start with one habit.',
  'Energy follows action. Move first, motivation comes later.',
  'Protect your mornings and your evenings will thank you.',
  'Rest is part of the plan, not a break from it.',
  'One focused hour beats three distracted ones.',
  'Fuel your body like it’s your most important project.',
  'Habits are the compound interest of self-improvement.',
  'Make it easy to start and hard to skip.',
  'The goal isn’t to be busy — it’s to be intentional.',
  'Hydrate, move, focus, rest. Repeat.',
  'You are one good day away from momentum.',
  'Strong body, clear mind, steady progress.',
  'Show up for yourself the way you show up for others.',
  'A streak starts with a single day.',
  'Less scrolling, more living.',
  'Write tomorrow’s priorities tonight; wake up with a plan.',
  'Curiosity is a habit too — read something that challenges you.',
  'Sleep is a performance enhancer. Guard it.',
  'Celebrate small wins; they add up.',
  'If it matters, schedule it.',
  'Keep promises to yourself — that’s where confidence comes from.',
  'Ordinary actions, done consistently, create extraordinary results.',
  'Today is a fresh page. Fill it well.',
];

export function motivationFor(date: DateKey): string {
  const n = diffDays(startOfYear(date), date) + Number(date.slice(0, 4));
  return MESSAGES[((n % MESSAGES.length) + MESSAGES.length) % MESSAGES.length];
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
