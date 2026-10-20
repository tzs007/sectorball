import type { Decision, Team } from '@sectorball/shared';

const OUT_TEXT = { throwIn: 'Bedobás', corner: 'Szöglet', goalKick: 'Kirúgás' } as const;

/** Toast copy for a referee decision, or null when nothing should be announced. */
export const decisionText = (d: Decision | null, _myTeam: Team): string | null => {
  if (d === null) return null;
  switch (d.kind) {
    case 'play':
      return d.pass ? 'Sikeres passz' : null;
    case 'goal':
      return d.ownGoal ? 'Öngól' : 'GÓL!';
    case 'goalDisallowed':
      return 'Nem érvényes gól – kirúgás';
    case 'foul':
      return d.penalty ? 'Tizenegyes!' : 'Szabálytalanság – szabadrúgás';
    case 'out':
      return OUT_TEXT[d.restart];
    case 'kickoffRetake':
      return 'Középkezdés újra';
    case 'turnTimeout':
      return 'Lejárt az idő';
    case 'halfTime':
      return 'Félidő';
    case 'fullTime':
      return 'Vége';
    default: {
      const unreachable: never = d;
      return unreachable;
    }
  }
};
