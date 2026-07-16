import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
/** @vitest-environment jsdom */

// stub the router the component uses
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// mock out the ui components referenced by the form (alias paths)
vi.mock("@/components/ui/button", () => ({
    Button: (props: any) => <button {...props} />,
}));
vi.mock("@/components/ui/input", () => ({
    Input: (props: any) => <input {...props} />,
}));
vi.mock("@/components/ui/card", () => {
    const Card = (props: any) => <div {...props} />;
    const CardContent = (props: any) => <div {...props} />;
    return { default: Card, CardContent };
});

import AddMemberForm from "../components/AddMemberForm";

describe("AddMemberForm", () => {
    let globalFetch: any;
    let alertSpy: any;

    beforeEach(() => {
        alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
        globalFetch = vi.spyOn(global, "fetch");
    });

    afterEach(() => {
        globalFetch.mockRestore();
        alertSpy.mockRestore();
        vi.resetAllMocks();
    });

    it("shows user-friendly message when server returns unique_violation", async () => {
        // mock csrf token call first
        globalFetch.mockImplementation((url: string) => {
            if (String(url).includes("/api/auth/csrf")) {
                return Promise.resolve(
                    new Response(JSON.stringify({ csrfToken: "tok" }), {
                        status: 200,
                    }),
                );
            }
            // for POST users return 409
            return Promise.resolve(
                new Response(JSON.stringify({ error: "unique_violation" }), {
                    status: 409,
                }),
            );
        });

        render(<AddMemberForm />);

        fireEvent.change(screen.getByPlaceholderText("Full name"), {
            target: { value: "Foo Bar" },
        });
        fireEvent.change(screen.getByPlaceholderText("name@company.com"), {
            target: { value: "foo@bar.com" },
        });

        // the form uses a "Create" button
        fireEvent.click(screen.getByRole("button", { name: /create/i }));

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith(
                "A user with that email or staff ID already exists.",
            );
        });
    });
});
