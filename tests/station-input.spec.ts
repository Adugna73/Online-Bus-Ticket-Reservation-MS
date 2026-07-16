import { describe, expect, it } from "vitest";

import { parseStationInput } from "../lib/station-input";

describe("parseStationInput", () => {
    it("parses explicit station codes in parentheses", () => {
        expect(parseStationInput("Nekemte (NKMT)")).toEqual({
            name: "Nekemte",
            code: "NKMT",
        });
    });

    it("creates a station payload from a plain station name", () => {
        expect(parseStationInput("Addis Ababa")).toEqual({
            name: "Addis Ababa",
            code: "ADDISABABA",
        });
    });

    it("returns null for empty input", () => {
        expect(parseStationInput("   ")).toBeNull();
    });
});
