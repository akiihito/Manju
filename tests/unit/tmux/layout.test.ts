import { describe, it, expect } from "vitest";
import { calculateLayout, getTotalPanes, getPaneNames } from "../../../src/tmux/layout.js";
import { DEFAULT_TEAM } from "../../../src/types.js";

describe("layout", () => {
  describe("calculateLayout", () => {
    it("should create correct layout for default team", () => {
      const layout = calculateLayout(DEFAULT_TEAM);

      // 6 panes total: coordinator + 2 investigators + 2 implementers + 1 tester
      expect(layout.panes).toHaveLength(6);

      // 3 rows
      expect(layout.rows).toHaveLength(3);

      // Row 0: coordinator + 2 investigators
      expect(layout.rows[0]).toHaveLength(3);
      expect(layout.rows[0][0].role).toBe("coordinator");
      expect(layout.rows[0][1].role).toBe("investigator");
      expect(layout.rows[0][2].role).toBe("investigator");

      // Row 1: 2 implementers
      expect(layout.rows[1]).toHaveLength(2);
      expect(layout.rows[1][0].role).toBe("implementer");
      expect(layout.rows[1][1].role).toBe("implementer");

      // Row 2: 1 tester
      expect(layout.rows[2]).toHaveLength(1);
      expect(layout.rows[2][0].role).toBe("tester");
    });

    it("should handle custom team sizes", () => {
      const layout = calculateLayout({
        investigators: 1,
        implementers: 3,
        testers: 2,
      });

      // 1 + 1 + 3 + 2 = 7 panes
      expect(layout.panes).toHaveLength(7);
      expect(layout.rows).toHaveLength(3);

      // Row 0: coordinator + 1 investigator
      expect(layout.rows[0]).toHaveLength(2);

      // Row 1: 3 implementers
      expect(layout.rows[1]).toHaveLength(3);

      // Row 2: 2 testers
      expect(layout.rows[2]).toHaveLength(2);
    });

    it("should handle zero implementers", () => {
      const layout = calculateLayout({
        investigators: 1,
        implementers: 0,
        testers: 1,
      });

      // 1 + 1 + 0 + 1 = 3 panes
      expect(layout.panes).toHaveLength(3);
      expect(layout.rows).toHaveLength(2);
    });

    it("should handle zero testers", () => {
      const layout = calculateLayout({
        investigators: 1,
        implementers: 1,
        testers: 0,
      });

      // 1 + 1 + 1 + 0 = 3 panes
      expect(layout.panes).toHaveLength(3);
      expect(layout.rows).toHaveLength(2);
    });

    it("should assign sequential pane IDs", () => {
      const layout = calculateLayout(DEFAULT_TEAM);
      const ids = layout.panes.map((p) => p.id);
      expect(ids).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it("should assign correct names", () => {
      const layout = calculateLayout(DEFAULT_TEAM);
      const names = layout.panes.map((p) => p.name);
      expect(names).toEqual([
        "coordinator",
        "investigator-1",
        "investigator-2",
        "implementer-1",
        "implementer-2",
        "tester-1",
      ]);
    });
  });

  describe("getTotalPanes", () => {
    it("should return correct total for default team", () => {
      expect(getTotalPanes(DEFAULT_TEAM)).toBe(6);
    });

    it("should include coordinator in count", () => {
      expect(getTotalPanes({ investigators: 0, implementers: 0, testers: 0 })).toBe(1);
    });
  });

  describe("getPaneNames", () => {
    it("should return all pane names in order", () => {
      const names = getPaneNames(DEFAULT_TEAM);
      expect(names).toEqual([
        "coordinator",
        "investigator-1",
        "investigator-2",
        "implementer-1",
        "implementer-2",
        "tester-1",
      ]);
    });
  });
});
