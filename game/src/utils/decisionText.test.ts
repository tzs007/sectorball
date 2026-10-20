import { describe, expect, it } from 'vitest';
import { vec } from '@sectorball/shared';
import type { Decision } from '@sectorball/shared';
import { decisionText } from './decisionText';

const at = vec(0, 0);
const cases: [Decision | null, string | null][] = [
  [{ kind: 'play', pass: true }, 'Sikeres passz'],
  [{ kind: 'play', pass: false }, null],
  [{ kind: 'goal', scorer: 'home', ownGoal: false }, 'GÓL!'],
  [{ kind: 'goal', scorer: 'home', ownGoal: true }, 'Öngól'],
  [{ kind: 'goalDisallowed', awardedTo: 'away' }, 'Nem érvényes gól – kirúgás'],
  [{ kind: 'foul', awardedTo: 'home', at, penalty: false }, 'Szabálytalanság – szabadrúgás'],
  [{ kind: 'foul', awardedTo: 'home', at, penalty: true }, 'Tizenegyes!'],
  [{ kind: 'out', restart: 'throwIn', awardedTo: 'home', at }, 'Bedobás'],
  [{ kind: 'out', restart: 'corner', awardedTo: 'home', at }, 'Szöglet'],
  [{ kind: 'out', restart: 'goalKick', awardedTo: 'home', at }, 'Kirúgás'],
  [{ kind: 'kickoffRetake' }, 'Középkezdés újra'],
  [{ kind: 'turnTimeout', team: 'home' }, 'Lejárt az idő'],
  [{ kind: 'halfTime' }, 'Félidő'],
  [{ kind: 'fullTime' }, 'Vége'],
  [null, null],
];

describe('decisionText', () => {
  it.each(cases)('maps %j to %s', (decision, text) => {
    expect(decisionText(decision, 'home')).toBe(text);
  });
});
