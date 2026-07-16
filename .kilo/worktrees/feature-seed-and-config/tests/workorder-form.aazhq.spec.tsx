import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
/** @vitest-environment jsdom */
// Mock aliases imported by the component
vi.mock("@/lib/assignment", () => ({
    isAazOrHqSite: (zoneName: any, regionName: any) => {
        const zn = String(zoneName || "").toLowerCase();
        const rn = String(regionName || "").toLowerCase();
        return (
            zn.includes("hq") ||
            zn.includes("aaz") ||
            rn.includes("aaz") ||
            rn.includes("hq")
        );
    },
}));
vi.mock("@/lib/taskNumber", () => ({ generatePmTaskNumber: () => "PM-TEST" }));

import WorkOrderForm from "../components/WorkOrderForm";

// dynamic session mock to simulate loading state then supervisor fills in
let sessionData: any = { data: null };
vi.mock("next-auth/react", () => ({
    useSession: () => sessionData,
}));

// helper to update session and re-render
function updateSession(user: any) {
    sessionData = { data: { user } };
}

// Mock next/navigation used by the component
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// Minimal props for the component
const baseProps = { teams: [], users: [], sites: [], templates: [] };

describe("WorkOrderForm — AAZ/HQ supervisor UX", () => {
    let globalFetch: any;

    beforeEach(() => {
        globalFetch = vi.spyOn(global, "fetch");
        globalFetch.mockImplementation((input: any) => {
            // normalize URL string from Request or string argument
            const url =
                typeof input === "string" ? input : input?.url || String(input);
            if (url.includes("/api/zones/manager")) {
                return Promise.resolve(
                    new Response(JSON.stringify([]), { status: 200 }),
                );
            }
            if (url.includes("/api/zones")) {
                // return several zones including the HQ-Microwave zone
                const zones = [
                    {
                        id: "hq-microwave-zone-id",
                        name: "HQ-Microwave",
                        regionId: "r-hq",
                    },
                    { id: "waaz-zone-id", name: "WAAZ", regionId: "r-waaz" },
                    { id: "aaaz-zone-id", name: "AAZ-01", regionId: "r-aaz" },
                ];
                return Promise.resolve(
                    new Response(JSON.stringify(zones), { status: 200 }),
                );
            }
            if (url.includes("/api/regions")) {
                return Promise.resolve(
                    new Response(JSON.stringify([]), { status: 200 }),
                );
            }
            if (url.includes("/api/users")) {
                return Promise.resolve(
                    new Response(JSON.stringify([]), { status: 200 }),
                );
            }
            if (url.includes("/api/sites")) {
                // return a couple of sample sites mapped to zones so the form can
                // exercise zone filtering
                const sites = [
                    {
                        id: "site1",
                        name: "Site One",
                        zoneId: "aaaz-zone-id",
                        regionId: "r-aaz",
                        // include nested names to satisfy the AAZ/HQ filter
                        zone: { id: "aaaz-zone-id", name: "AAZ-01" },
                        region: { id: "r-aaz", name: "Region AAZ" },
                    },
                    {
                        id: "site2",
                        name: "Site Two",
                        zoneId: "waaz-zone-id",
                        regionId: "r-waaz",
                        zone: { id: "waaz-zone-id", name: "WAAZ" },
                        region: { id: "r-waaz", name: "Region WAAZ" },
                    },
                ];
                return Promise.resolve(
                    new Response(JSON.stringify(sites), { status: 200 }),
                );
            }
            return Promise.resolve(
                new Response(JSON.stringify([]), { status: 200 }),
            );
        });
    });

    afterEach(() => {
        globalFetch.mockRestore();
        vi.resetAllMocks();
    });

    it('does NOT auto-select manager-assigned HQ zone and shows "Select Zone" for AAZ/HQ supervisors', async () => {
        const { rerender } = render(<WorkOrderForm {...baseProps} />);

        // initial load with no session (simulates loading state)
        await waitFor(() => {
            expect(globalFetch).toHaveBeenCalled();
        });

        // now provide the supervisor session and rerender the form
        updateSession({
            id: "HQ-Supervisor-1",
            email: "zeine.nesro@ethiotelecom.et",
            role: { key: "supervisor" },
            locationCategory: "Head Quarter",
            location: "Microwave",
            assignedRegion: ["r-aaz"],
            assignedZone: ["hq-microwave-zone-id"],
        });
        rerender(<WorkOrderForm {...baseProps} />);

        // after session is available, the Assigned Zone box should show the placeholder text
        await waitFor(() => {
            // target only the div that represents the Assigned Zone display
            const assignedDiv = screen.getByText("Select Zone", {
                selector: "div",
            });
            expect(assignedDiv).toBeTruthy();
        });

        // Ensure the HQ zone name is NOT rendered as the Assigned Zone fallback
        expect(screen.queryByText(/Assigned Zone: HQ-Microwave/i)).toBeNull();
    });

    it("allows explicit zone selection for AAZ/HQ supervisor and updates Assigned Zone", async () => {
        const user = await import("@testing-library/user-event");
        // set supervisor session before rendering so effects run with proper role
        updateSession({
            id: "HQ-Supervisor-1",
            email: "zeine.nesro@ethiotelecom.et",
            role: { key: "supervisor" },
            locationCategory: "Head Quarter",
            location: "Microwave",
            assignedRegion: ["r-aaz"],
            assignedZone: ["hq-microwave-zone-id"],
        });
        render(<WorkOrderForm {...baseProps} />);

        // Wait for zones and sites to be loaded
        await waitFor(() => expect(globalFetch).toHaveBeenCalled());

        // Find the zone <select> by scanning comboboxes for an option text we expect
        const selects = screen.getAllByRole("combobox");
        const zoneSelect: HTMLSelectElement | undefined = selects.find(
            (s: any) =>
                Array.from(s.querySelectorAll("option")).some(
                    (o: any) => o.textContent === "AAZ-01",
                ),
        ) as HTMLSelectElement | undefined;
        expect(zoneSelect).toBeDefined();

        // Select the AAZ zone explicitly (user action)
        user.default.selectOptions(zoneSelect!, "aaaz-zone-id");

        // Assigned Zone should now reflect the explicit choice
        await waitFor(() => {
            expect(screen.getByText(/Assigned Zone: AAZ-01/i)).toBeTruthy();
        });

        // Selecting the zone should also populate the site dropdown with the
        // corresponding site
        let siteOption = await screen.findByRole("option", {
            name: "Site One",
        });
        expect(siteOption).toBeTruthy();

        // now choose a different zone (WAAZ) that isn't in the supervisor's
        // assignedZone list; it should also fetch sites
        user.default.selectOptions(zoneSelect!, "waaz-zone-id");
        await waitFor(() => {
            expect(screen.getByText(/Assigned Zone: WAAZ/i)).toBeTruthy();
        });
        siteOption = await screen.findByRole("option", { name: "Site Two" });
        expect(siteOption).toBeTruthy();
    });

    it("manager dropdown filters users by selected zone", async () => {
        const user = await import("@testing-library/user-event");
        // provide manager-level user list with two technicians in different zones
        const mgrUsers = [
            {
                id: "u1",
                fullName: "Tech A",
                assignedRegion: ["r-aaz"],
                assignedZone: ["aaaz-zone-id"],
                role: { key: "technician" },
            },
            {
                id: "u2",
                fullName: "Tech B",
                assignedRegion: ["r-waaz"],
                assignedZone: ["waaz-zone-id"],
                role: { key: "technician" },
            },
        ];
        // set manager session with both zones assigned
        updateSession({
            id: "MGR-1",
            role: { key: "manager" },
            assignedRegion: ["r-aaz"],
            assignedZone: ["aaaz-zone-id", "waaz-zone-id"],
        });
        render(<WorkOrderForm {...baseProps} users={mgrUsers} />);

        // Wait for zones to load
        await waitFor(() => expect(globalFetch).toHaveBeenCalled());

        const selects = screen.getAllByRole("combobox");
        const zoneSelect = selects.find((s: any) =>
            Array.from(s.querySelectorAll("option")).some(
                (o: any) => o.textContent === "AAZ-01",
            ),
        ) as HTMLSelectElement | undefined;
        expect(zoneSelect).toBeDefined();

        // choose WAAZ zone and verify only Tech B appears in assign list
        user.default.selectOptions(zoneSelect!, "waaz-zone-id");
        await waitFor(() =>
            expect(screen.getByText(/Assigned Zone: WAAZ/i)).toBeTruthy(),
        );
        const techOption = await screen.findByRole("option", {
            name: /Tech B/,
        });
        expect(techOption).toBeTruthy();
        expect(screen.queryByText(/Tech A/)).toBeNull();
    });
});
