import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import WorkOrdersClient from "../components/WorkOrdersClient";

/** @vitest-environment jsdom */

// simple session mock
let sessionData: any = { data: null };
vi.mock("next-auth/react", () => ({
    useSession: () => sessionData,
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// stub DataTable since it's heavy and not required for this test
vi.mock("../components/dashboard/DataTable", () => ({
    __esModule: true,
    default: ({ rows }: any) => (
        <div data-testid="datatable">{rows.length} rows</div>
    ),
    WorkOrderRow: {} as any,
}));

// no network calls needed; WorkOrdersClient fetches teams/users/sites/templates
beforeEach(() => {
    global.fetch = vi.fn((url: string) => {
        const empty: any[] = [];
        return Promise.resolve(
            new Response(JSON.stringify(empty), { status: 200 }),
        );
    }) as any;
    sessionData = { data: { user: { id: "u1", role: "manager" } } };
});

describe("WorkOrdersClient header count", () => {
    it("shows bracketed count equal to number of work orders", async () => {
        // provide fake work orders via fetch stub on second call
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes("/api/workorders")) {
                return Promise.resolve(
                    new Response(JSON.stringify([{ id: "1" }, { id: "2" }]), {
                        status: 200,
                    }),
                );
            }
            return Promise.resolve(
                new Response(JSON.stringify([]), { status: 200 }),
            );
        });

        render(<WorkOrdersClient />);

        // wait for table to render and the count to appear
        await waitFor(() =>
            expect(screen.getByText(/\[\s*2\s*\]/)).toBeTruthy(),
        );
    });
});
