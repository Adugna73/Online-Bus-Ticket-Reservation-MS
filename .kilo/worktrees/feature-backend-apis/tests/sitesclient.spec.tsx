import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// virtual mocks for modules that would otherwise require path resolution
vi.mock("@/lib/utils", () => ({
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// mock UI components that the client imports but aren't needed for logic
vi.mock("@/components/ui/button", () => ({
    Button: ({ children }: any) => <button>{children}</button>,
}));

import SitesClient from "../components/SitesClient";

/** @vitest-environment jsdom */

// session mock with assignedRegion but not a manager/supervisor role
let sessionData: any = { data: null };
vi.mock("next-auth/react", () => ({
    useSession: () => sessionData,
}));

// navigation mocks used by SitesClient
vi.mock("next/navigation", () => ({
    useSearchParams: () => ({ get: (_: string) => null }),
}));

// simple fetch stub capturing URLs
let fetchCalls: string[] = [];
beforeEach(() => {
    fetchCalls = [];
    global.fetch = vi.fn((url: string) => {
        fetchCalls.push(url);
        // respond with empty arrays by default
        return Promise.resolve(
            new Response(JSON.stringify([]), { status: 200 }),
        );
    }) as any;
    // prepare session user with assignedRegion id
    sessionData = {
        data: {
            user: {
                id: "user1",
                role: { key: "operator" }, // not manager or supervisor
                assignedRegion: ["r-test"],
                assignedZone: [],
            },
        },
    };
});

describe("SitesClient region supervisor support", () => {
    it("auto-selects assigned region and fetches sites/ne with region name", async () => {
        // stub regions endpoint to return the matching region name
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes("/api/regions")) {
                return Promise.resolve(
                    new Response(
                        JSON.stringify([{ id: "r-test", name: "TestRegion" }]),
                        { status: 200 },
                    ),
                );
            }
            if (url.includes("/api/zones")) {
                return Promise.resolve(
                    new Response(JSON.stringify([]), { status: 200 }),
                );
            }
            // all others return empty as default (set earlier)
            fetchCalls.push(url);
            return Promise.resolve(
                new Response(JSON.stringify([]), { status: 200 }),
            );
        });

        render(<SitesClient />);

        await waitFor(() => {
            // expect at least one call to sites with the region query string
            const match = fetchCalls.find((u) => u.startsWith("/api/sites?"));
            expect(match).toBeDefined();
            expect(match).toContain("region=TestRegion");
        });
    });
});
