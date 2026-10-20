import type { Vec } from './geometry.ts';

export type Team = 'home' | 'away';
export type Side = 'left' | 'right';
export type PieceId = `${Team}-${1 | 2 | 3 | 4 | 5}` | `${Team}-gk`;
export type Piece = {
  readonly id: PieceId;
  readonly team: Team;
  readonly kind: 'button' | 'keeper';
  readonly pos: Vec;
};
export type Restart =
  | { readonly kind: 'kickoff' }
  | { readonly kind: 'freeKick' }
  | { readonly kind: 'throwIn' }
  | { readonly kind: 'corner' }
  | { readonly kind: 'goalKick' }
  | { readonly kind: 'penalty'; readonly kickerId: PieceId };
export type Phase = 'aiming' | 'keeperSetup' | 'finished';
export type Decision =
  | { readonly kind: 'play'; readonly pass: boolean }
  | { readonly kind: 'goal'; readonly scorer: Team; readonly ownGoal: boolean }
  | { readonly kind: 'goalDisallowed'; readonly awardedTo: Team }
  | { readonly kind: 'foul'; readonly awardedTo: Team; readonly at: Vec; readonly penalty: boolean }
  | {
      readonly kind: 'out';
      readonly restart: 'throwIn' | 'corner' | 'goalKick';
      readonly awardedTo: Team;
      readonly at: Vec;
    }
  | { readonly kind: 'kickoffRetake' }
  | { readonly kind: 'turnTimeout'; readonly team: Team }
  | { readonly kind: 'halfTime' }
  | { readonly kind: 'fullTime' };
export type GameState = {
  readonly matchId: string;
  readonly phase: Phase;
  readonly half: 1 | 2;
  readonly turn: Team;
  readonly firstKickoff: Team;
  readonly score: Readonly<Record<Team, number>>;
  readonly pieces: readonly Piece[];
  readonly ball: Vec;
  readonly restart: Restart | null;
  readonly shotDeclared: boolean;
  readonly halfStartedAt: number;
  readonly turnStartedAt: number;
  readonly lastDecision: Decision | null;
  readonly winner: Team | 'draw' | null;
  readonly seq: number;
};
/** Body id ('ball' | PieceId) to [x, y]. */
export type Frame = Readonly<Record<string, readonly [number, number]>>;
export type Replay = { readonly frames: readonly Frame[]; readonly frameMs: number };
export type GameError =
  | 'notYourTurn'
  | 'wrongPhase'
  | 'invalidPiece'
  | 'invalidPull'
  | 'shotNotAllowed'
  | 'invalidKeeperPosition'
  | 'matchFinished'
  | 'staleState';
export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: GameError };

export const other = (team: Team): Team => (team === 'home' ? 'away' : 'home');
