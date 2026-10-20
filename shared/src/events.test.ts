import { describe, expect, it } from "vitest";
import type { MatchSummary } from "./events.ts";
import { teamOf } from "./events.ts";

const summary = (away: MatchSummary["away"]): MatchSummary => ({
  id: "m",
  status: away ? "live" : "open",
  home: { id: "h", nickname: "Home" },
  away,
  createdAt: "2026-10-17T00:00:00.000Z",
});

describe("teamOf", () => {
  const full = summary({ id: "a", nickname: "Away" });

  it("maps the home player to home", () => {
    expect(teamOf(full, "h")).toBe("home");
  });

  it("maps the away player to away", () => {
    expect(teamOf(full, "a")).toBe("away");
  });

  it("returns null for a stranger", () => {
    expect(teamOf(full, "x")).toBeNull();
  });

  it("returns null for any non-home id on an open match", () => {
    const open = summary(null);
    expect(teamOf(open, "h")).toBe("home");
    expect(teamOf(open, "x")).toBeNull();
  });
});
