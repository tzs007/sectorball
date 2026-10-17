import { clampToField, defendedSide, isInPenaltyArea, ownerOfSide } from './field.ts';
import type { Contact, SimResult } from './physics.ts';
import { other } from './types.ts';
import type { Decision, GameState, Piece, Side, Team } from './types.ts';

const BALL = 'ball';

const involves = (c: Contact, id: string): boolean => c.a === id || c.b === id;
const partner = (c: Contact, id: string): string => (c.a === id ? c.b : c.a);

/** Team of the last piece that touched the ball (posts ignored). */
const lastToucher = (state: GameState, sim: SimResult): Team | null => {
  for (const c of sim.contacts.toReversed()) {
    if (!involves(c, BALL)) continue;
    const piece = state.pieces.find((p) => p.id === partner(c, BALL));
    if (piece) return piece.team;
  }
  return null;
};

/** Foul: the shooter touches an opponent outfield button before it has touched the ball. */
const judgeFoul = (state: GameState, shooter: Piece, sim: SimResult): Decision | null => {
  for (const c of sim.contacts) {
    if (!involves(c, shooter.id)) continue;
    const otherId = partner(c, shooter.id);
    if (otherId === BALL) return null;
    const victim = state.pieces.find((p) => p.id === otherId);
    if (victim?.kind === 'button' && victim.team !== shooter.team) {
      // a contact just behind the goal line counts at the line (inside the goal mouth: in the area)
      const at = clampToField(c.at);
      return {
        kind: 'foul',
        awardedTo: other(shooter.team),
        at,
        penalty: isInPenaltyArea(at, defendedSide(shooter.team, state.half)),
      };
    }
  }
  return null;
};

const judgeGoal = (state: GameState, shooter: Piece, side: Side): Decision => {
  const owner = ownerOfSide(side, state.half);
  const ownGoal = shooter.team === owner;
  const valid = ownGoal || state.shotDeclared || state.restart?.kind === 'penalty';
  return valid ? { kind: 'goal', scorer: other(owner), ownGoal } : { kind: 'goalDisallowed', awardedTo: owner };
};

const hasPass = (state: GameState, shooter: Piece, sim: SimResult): boolean => {
  const first = sim.contacts.findIndex((c) => involves(c, BALL) && involves(c, shooter.id));
  if (first < 0) return false;
  return sim.contacts.slice(first + 1).some((c) => {
    if (!involves(c, BALL)) return false;
    const toucher = state.pieces.find((p) => p.id === partner(c, BALL));
    return toucher?.kind === 'button' && toucher.team === shooter.team && toucher.id !== shooter.id;
  });
};

/** Turns a simulated shot into a rules decision, in the spec's priority order. */
export const judgeShot = (state: GameState, shooter: Piece, sim: SimResult): Decision => {
  const foul = judgeFoul(state, shooter, sim);
  if (foul) return foul;

  const exit = sim.ballExit;
  if (exit?.kind === 'goal') return judgeGoal(state, shooter, exit.side);

  if (exit) {
    const lastTouch = lastToucher(state, sim) ?? shooter.team;
    if (exit.line === 'touchline') {
      return { kind: 'out', restart: 'throwIn', awardedTo: other(lastTouch), at: exit.at };
    }
    const defender = ownerOfSide(exit.side, state.half);
    return lastTouch === defender
      ? { kind: 'out', restart: 'corner', awardedTo: other(defender), at: exit.at }
      : { kind: 'out', restart: 'goalKick', awardedTo: defender, at: exit.at };
  }

  if (state.restart?.kind === 'kickoff' && !sim.ballLeftCenterCircle) return { kind: 'kickoffRetake' };
  return { kind: 'play', pass: hasPass(state, shooter, sim) };
};
