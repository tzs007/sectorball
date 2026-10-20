export const FIELD = { width: 1000, height: 640, margin: 40 } as const;

export const GOAL = { mouthTop: 240, mouthBottom: 400, depth: 30, postRadius: 4 } as const;

export const PENALTY_AREA = { depth: 150, top: 140, bottom: 500 } as const;

export const PENALTY_SPOT_DISTANCE = 110;

export const CENTER = { x: 500, y: 320, circleRadius: 90 } as const;

export const PIECE = {
  buttonRadius: 22,
  ballRadius: 10,
  keeperWidth: 14,
  keeperHeight: 56,
  keeperLineOffset: 9,
} as const;

export const PHYSICS = {
  dt: 1 / 120,
  buttonDecel: 900,
  ballDecel: 1000,
  restitution: 0.9,
  keeperRestitution: 0.7,
  postRestitution: 0.6,
  buttonMass: 1,
  ballMass: 0.5,
  maxShotSpeed: 1100,
  stopSpeed: 2,
  maxSteps: 2400,
  frameEvery: 2,
} as const;

export const SHOT = { minPull: 10, maxPull: 160 } as const;

export const TIMING = { halfLengthMs: 600_000, turnLimitMs: 30_000, keeperSetupLimitMs: 15_000 } as const;

export const RESTART = { freeKickDistance: 60, goalKickDistance: 60, penaltyKickerOffset: 40 } as const;
