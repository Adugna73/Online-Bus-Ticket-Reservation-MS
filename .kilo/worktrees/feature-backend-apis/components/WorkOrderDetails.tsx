"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import PassengerChecklistForm from "./TechnicianChecklistForm";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
// removed incorrect default router import

function extractNeFromTitle(title?: string, siteName?: string): string | null {
    if (!title) return null;
    const parts = title.split(" - ");
    if (parts.length < 2) return null;
    const neSegment = parts.slice(1).join(" - ").trim();
    if (!neSegment) return null;
    if (siteName) {
        const siteSlug = siteName.toLowerCase().replace(/\s+/g, "");
        const neSlug = neSegment.toLowerCase().replace(/\s+/g, "");
        if (neSlug === siteSlug) return null;
    }
    return neSegment;
}

export default function WorkOrderDetails({ id }: { id: string }) {
    const { data: session } = useSession();
    const [workOrder, setWorkOrder] = useState<any | null>(null);
    const [checklist, setChecklist] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [attachments, setAttachments] = useState<any[]>([]);
    const [reviewFinding, setReviewFinding] = useState<string>("ok");
    const [reviewNote, setReviewNote] = useState<string>("");
    const [activeSection, setActiveSection] = useState(0);
    const roleKey = String(session?.user?.role || "").toLowerCase();
    const isPassenger = roleKey === "passenger";
    const isReviewer = ["manager", "supervisor", "admin"].includes(roleKey);
    const [attachmentType, setAttachmentType] = useState("");
    const [uploading, setUploading] = useState(false);
    const { toast } = useToast();
    const nav = useRouter();
    const [currentUser, setCurrentUser] = useState<any | null>(null);

    useEffect(() => {
        if (activeSection > 3) {
            setActiveSection(3);
        }
    }, [activeSection]);

    // Load current user details (including teamId) so passengers in a group team
    // can claim group-assigned bookings.
    useEffect(() => {
        (async () => {
            try {
                const meId = (session?.user as any)?.id;
                if (!meId) return;
                const r = await fetch(`/api/users/${meId}`);
                if (!r.ok) return;
                const data = await r.json();
                setCurrentUser(data || null);
            } catch (e) {
                // ignore
            }
        })();
    }, [session?.user]);

    useEffect(() => {
        (async () => {
            const r = await fetch(`/api/workorders/${id}`);
            if (r.ok) {
                const data = await r.json();
                setWorkOrder(data);
                if (data.checklist) setChecklist(data.checklist.items || []);
                if (data.attachments) setAttachments(data.attachments || []);
            }
        })();
    }, [id]);

    const refresh = async () => {
        const r = await fetch(`/api/workorders/${id}`);
        if (r.ok) {
            const data = await r.json();
            setWorkOrder(data);
            if (data.checklist) setChecklist(data.checklist.items || []);
            if (data.attachments) setAttachments(data.attachments || []);
        }
    };

    const me = session?.user as any;
    const passengerCanEdit =
        isPassenger &&
        !workOrder?.archived &&
        me?.id &&
        workOrder?.assignedTo?.id === me.id;

    const passengerCanClaimFromTeam =
        isPassenger &&
        !workOrder?.archived &&
        !workOrder?.assignedTo &&
        workOrder?.team?.id &&
        currentUser?.teamId &&
        currentUser.teamId === workOrder.team.id;

    const handleTakeOrder = async () => {
        if (!me?.id || !workOrder || workOrder.archived) return;
        try {
            const r = await fetch(`/api/workorders/${id}` as string, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ assignedToId: me.id }),
            });
            if (!r.ok) {
                const text = await r.text().catch(() => "");
                toast({
                    title: "Failed to take booking",
                    description: text || `Status ${r.status}`,
                    variant: "destructive",
                });
                return;
            }
            await refresh();
            toast({ title: "You are now assigned to this booking." });
        } catch (e) {
            console.error(e);
            toast({
                title: "Error taking booking",
                description: String(e),
                variant: "destructive",
            });
        }
    };

    const handleStaffAction = async (
        action: "approve" | "reject" | "reassign",
    ) => {
        // For approve action we perform immediately without the browser confirm.
        if (action !== "approve") {
            if (!confirm(`Perform action: ${action}?`)) return;
        }
        let note: string | undefined = reviewNote || undefined;
        let reassignToId: string | undefined = undefined;
        if (action === "reject" && !note) {
            note =
                window.prompt("Enter rejection note for the passenger") ||
                undefined;
        }
        if (action === "reassign") {
            reassignToId =
                window.prompt(
                    "Enter user id to reassign to (passenger id)",
                    workOrder?.assignedTo?.id || "",
                ) || undefined;
            if (!reassignToId) {
                alert("No reassignment id provided");
                return;
            }
        }
        try {
            const r = await fetch(`/api/workorders/${id}/checklist`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    reviewAction: action,
                    reviewNote: note,
                    reassignToId,
                    reviewFinding,
                }),
            });
            if (!r.ok) {
                const t = await r.text().catch(() => "");
                toast({
                    title: `Action failed: ${r.status}`,
                    description: t || undefined,
                    variant: "destructive",
                });
            } else {
                // Use toast for better UX and navigate back to role workorders
                const json = await r.json().catch(() => ({}));
                const message =
                    json && json.action === "approved"
                        ? "Completed successfully"
                        : "Action performed";
                toast({ title: message });
                // If server returned the updated workOrder, update local state
                if (json && json.workOrder) {
                    setWorkOrder(json.workOrder);
                }
                // Refresh local state then navigate to role workorders list
                await refresh();
                const role = String(session?.user?.role || "").toLowerCase();
                try {
                    // give toast a moment to appear before navigating
                    setTimeout(() => {
                        try {
                            nav.replace(`/${role}/bookings`);
                        } catch (e) {}
                    }, 2000);
                } catch (e) {
                    // ignore navigation errors
                }
            }
        } catch (e) {
            console.error(e);
            alert("Error performing action");
        }
    };

    const toggleItem = (index: number) => {
        setChecklist((cur) =>
            cur.map((i: any, idx: number) =>
                idx === index ? { ...i, done: !i.done } : i,
            ),
        );
    };

    const saveChecklist = async () => {
        setLoading(true);
        try {
            const r = await fetch(`/api/workorders/${id}/checklist`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ items: checklist }),
            });
            if (r.ok) {
                const saved = await r.json();
                setWorkOrder((w: any) => ({ ...w, checklist: saved }));
                alert("Checklist saved");
            } else {
                alert("Failed saving");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving checklist");
        }
        setLoading(false);
    };

    const uploadAttachment = async (file: File) => {
        if (!attachmentType) {
            alert("Please select attachment type");
            return;
        }

        // Prevent giant uploads before hitting the server
        const maxBytes = 20 * 1024 * 1024; // 20 MB
        if (file.size > maxBytes) {
            alert("File is too large (max 20 MB). Please pick a smaller file.");
            return;
        }

        // Ensure image formats are supported
        const allowed = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/jpg",
        ];
        if (file.type && !allowed.includes(file.type)) {
            alert("Unsupported file type. Please upload a JPG/PNG/WebP image.");
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("type", attachmentType);
            const r = await fetch(`/api/workorders/${id}/attachments`, {
                method: "POST",
                body: formData,
            });

            if (r.ok) {
                const newAttachment = await r.json();
                setAttachments((prev) => [...prev, newAttachment]);
                setAttachmentType("");
                alert("Attachment uploaded");
            } else {
                if (r.status === 413) {
                    alert(
                        "Upload failed: file too large. Please use a smaller image.",
                    );
                } else if (r.status === 415) {
                    alert(
                        "Upload failed: unsupported file format. Use JPG/PNG/WebP.",
                    );
                } else {
                    const json = await r.json().catch(() => null);
                    alert(
                        json?.error
                            ? `Upload failed: ${json.error}`
                            : "Upload failed",
                    );
                }
            }
        } catch (e: any) {
            console.error(e);
            alert(
                e?.message
                    ? `Error uploading attachment: ${e.message}`
                    : "Error uploading attachment",
            );
        }
        setUploading(false);
    };

    if (!workOrder) return <div>Loading...</div>;
    const totalSections = 4;
    return (
        <div className="space-y-4">
            {/* Completed banner shown under the global header when booking is archived/completed */}
            {(workOrder.archived || workOrder.status === "completed") && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div className="font-medium">Booking completed</div>
                        <div className="text-sm text-foreground/80">
                            {workOrder.completedBy?.fullName ||
                            workOrder.completedById ? (
                                <span>
                                    Completed by{" "}
                                    {workOrder.completedBy?.fullName ||
                                        workOrder.completedById}
                                    {workOrder.completedAt
                                        ? ` — ${new Date(
                                              workOrder.completedAt,
                                          ).toLocaleString()}`
                                        : ""}
                                </span>
                            ) : null}
                            {workOrder.reviewedBy || workOrder.reviewedAt ? (
                                <span className="block md:inline">
                                    {workOrder.reviewedBy?.fullName ||
                                    workOrder.reviewedById
                                        ? " · Reviewed"
                                        : ""}
                                    {workOrder.reviewedBy?.fullName
                                        ? ` by ${workOrder.reviewedBy.fullName}`
                                        : workOrder.reviewedById
                                          ? ` by ${workOrder.reviewedById}`
                                          : ""}
                                    {workOrder.reviewedAt
                                        ? ` — ${new Date(
                                              workOrder.reviewedAt,
                                          ).toLocaleString()}`
                                        : ""}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
            {/* Section count hidden by request */}
            <div
                className={`space-y-4 ${
                    activeSection === 0 ? "block" : "hidden"
                } md:block`}
            >
                <div className="bg-background text-foreground p-4 rounded shadow">
                    <h2 className="font-semibold">{workOrder.title}</h2>
                    {workOrder.taskNumber && (
                        <div className="text-sm text-foreground mt-1">
                            Task Number: {workOrder.taskNumber}
                        </div>
                    )}
                    <div className="text-sm text-foreground">
                        {workOrder.description}
                    </div>
                </div>
                {/* Site Information */}
                {workOrder.site && (
                    <div className="bg-background text-foreground p-4 rounded shadow">
                        <h3 className="font-semibold mb-3">Site Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <strong>Site Name:</strong>{" "}
                                {workOrder.site.name || "N/A"}
                            </div>
                            <div>
                                <strong>Physical Site ID:</strong>{" "}
                                {workOrder.site.siteCode || "N/A"}
                            </div>
                            {workOrder.site.zone?.name ? (
                                <div>
                                    <strong>Location / Area:</strong>{" "}
                                    {workOrder.site.zone.name}
                                </div>
                            ) : (
                                <div>
                                    <strong>Region:</strong>{" "}
                                    {workOrder.site.region?.name || "N/A"}
                                </div>
                            )}
                            <div>
                                <strong>NE Name and ID:</strong>{" "}
                                {extractNeFromTitle(
                                    workOrder.title,
                                    workOrder.site?.name,
                                ) ||
                                    workOrder.site.neNameAndId ||
                                    "N/A"}
                            </div>
                            <div>
                                <strong>Device Model:</strong>{" "}
                                {workOrder.site.deviceModel || "N/A"}
                            </div>
                            <div>
                                <strong>Vendor:</strong>{" "}
                                {workOrder.site.vendor || "N/A"}
                            </div>
                            <div>
                                <strong>Running State:</strong>{" "}
                                {workOrder.site.runningState || "N/A"}
                            </div>
                            <div>
                                <strong>Longitude:</strong>{" "}
                                {workOrder.site.longitude || "N/A"}
                            </div>
                            <div>
                                <strong>Latitude:</strong>{" "}
                                {workOrder.site.latitude || "N/A"}
                            </div>
                            <div className="md:col-span-2">
                                <strong>Address:</strong>{" "}
                                {workOrder.site.address || "N/A"}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* Assignment + Completion */}
            <div
                className={`space-y-4 ${
                    activeSection === 1 ? "block" : "hidden"
                } md:block`}
            >
                <div className="bg-background text-foreground p-4 rounded shadow">
                    <h3 className="font-semibold mb-3">
                        Assignment Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <strong>Assigned To:</strong>{" "}
                            {workOrder.assignedTo?.fullName || "Not assigned"}
                        </div>
                        <div>
                            <strong>Team:</strong>{" "}
                            {workOrder.team?.name || "No team"}
                        </div>
                        <div>
                            <strong>Status:</strong>{" "}
                            {workOrder.status || "Unknown"}
                        </div>
                        <div>
                            <strong>Priority:</strong>{" "}
                            {workOrder.priority || "Normal"}
                        </div>
                    </div>
                </div>
                <div className="bg-background text-foreground p-4 rounded shadow">
                    <h3 className="font-semibold mb-3">Completion & Review</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <strong>Passenger Completed:</strong>{" "}
                            {workOrder.completedBy?.fullName ||
                                workOrder.completedById ||
                                "-"}
                        </div>
                        <div>
                            <strong>Completed At:</strong>{" "}
                            {workOrder.completedAt
                                ? new Date(
                                      workOrder.completedAt,
                                  ).toLocaleString()
                                : "-"}
                        </div>
                        <div>
                            <strong>Reviewed By:</strong>{" "}
                            {workOrder.reviewedBy?.fullName ||
                                workOrder.reviewedById ||
                                "-"}
                        </div>
                        <div>
                            <strong>Reviewed At:</strong>{" "}
                            {workOrder.reviewedAt
                                ? new Date(
                                      workOrder.reviewedAt,
                                  ).toLocaleString()
                                : "-"}
                        </div>
                        <div>
                            <strong>Archived At:</strong>{" "}
                            {workOrder.archivedAt
                                ? new Date(
                                      workOrder.archivedAt,
                                  ).toLocaleString()
                                : "-"}
                        </div>
                    </div>
                </div>
            </div>
            <div
                className={`bg-background text-foreground p-4 rounded shadow ${
                    activeSection === 2 || activeSection === 3
                        ? "block"
                        : "hidden"
                } md:block`}
            >
                <div className="font-semibold mb-3">
                    {activeSection === 2 ? "Location Capture" : "Checklist"}
                </div>
                {/* If the current session user is the assigned passenger, show the passenger checklist form.
                    For team-assigned orders without a specific passenger, passengers in that team can first
                    "take" the order, then the checklist becomes editable. Once archived, everyone sees a read-only
                    review view. */}
                {passengerCanEdit ? (
                    <PassengerChecklistForm
                        workOrderId={id}
                        initialItems={checklist}
                        checklistScope={workOrder.checklistScope || "full"}
                        onSaved={refresh}
                        enableStepNav={activeSection === 3}
                        view={activeSection === 2 ? "checkin" : "items"}
                    />
                ) : (
                    <>
                        {passengerCanClaimFromTeam && (
                            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                                <div className="font-medium mb-1">
                                    This booking is assigned to your group.
                                </div>
                                <div className="mb-2">
                                    Take this booking to become the assigned
                                    passenger, then you can check in and
                                    complete the checklist.
                                </div>
                                <button
                                    className="px-3 py-2 rounded bg-amber-600 text-white hover:bg-amber-700"
                                    onClick={handleTakeOrder}
                                >
                                    Take this booking
                                </button>
                            </div>
                        )}
                        {checklist.length === 0 && (
                            <div className="text-sm text-gray-500">
                                No checklist yet
                            </div>
                        )}
                        <ul className="space-y-4">
                            {checklist.map((item: any, idx: number) => (
                                <li key={idx} className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={!!item.done}
                                            onChange={() => toggleItem(idx)}
                                        />
                                        <div>
                                            <div className="font-medium">
                                                {item.task ||
                                                    item.name ||
                                                    item.label}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                {item.findings
                                                    ? Array.isArray(
                                                          item.findings,
                                                      )
                                                        ? item.findings.join(
                                                              ", ",
                                                          )
                                                        : item.findings
                                                    : ""}
                                            </div>
                                            <div className="mt-1 text-sm text-gray-700">
                                                <div>
                                                    <strong>Action:</strong>{" "}
                                                    {item.action || "-"}
                                                </div>
                                                <div>
                                                    <strong>Remark:</strong>{" "}
                                                    {item.remark || "-"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* show attachments for supervisors */}
                                    {item.attachments &&
                                        item.attachments.length > 0 && (
                                            <div className="pl-10">
                                                <div className="text-sm font-medium mb-2">
                                                    Photos
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {item.attachments.map(
                                                        (a: any, i: number) => {
                                                            const url =
                                                                typeof a ===
                                                                "string"
                                                                    ? a
                                                                    : a?.url ||
                                                                      "";
                                                            if (!url)
                                                                return null;
                                                            const alt =
                                                                (typeof a ===
                                                                    "object" &&
                                                                    (a.fileName ||
                                                                        a.name)) ||
                                                                `photo-${
                                                                    i + 1
                                                                }`;
                                                            return (
                                                                <a
                                                                    key={i}
                                                                    href={url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="block"
                                                                >
                                                                    <Image
                                                                        src={
                                                                            url
                                                                        }
                                                                        alt={
                                                                            alt
                                                                        }
                                                                        width={
                                                                            112
                                                                        }
                                                                        height={
                                                                            80
                                                                        }
                                                                        className="w-28 h-20 object-cover rounded"
                                                                        style={{
                                                                            objectFit:
                                                                                "cover",
                                                                            borderRadius:
                                                                                "0.375rem",
                                                                        }}
                                                                    />
                                                                </a>
                                                            );
                                                        },
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                </li>
                            ))}
                        </ul>
                        {/* For non-archived bookings, reviewers can save and act; archived bookings are read-only. */}
                        {!workOrder.archived && (
                            <div className="pt-4">
                                <div className="flex items-center gap-3">
                                    <button
                                        className="ossBtn"
                                        onClick={saveChecklist}
                                        disabled={loading}
                                    >
                                        {loading
                                            ? "Saving..."
                                            : "Save checklist"}
                                    </button>
                                </div>

                                {/* Reviewer information and actions */}
                                {isReviewer && (
                                    <div className="mt-4 border-t pt-4 space-y-3">
                                        {workOrder?.status ===
                                        "under_review" ? (
                                            <>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                                                    <label className="text-sm font-medium">
                                                        Finding
                                                    </label>
                                                    <div className="md:col-span-2">
                                                        <select
                                                            value={
                                                                reviewFinding
                                                            }
                                                            onChange={(e) =>
                                                                setReviewFinding(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            className="border p-2 rounded w-full"
                                                        >
                                                            <option value="ok">
                                                                OK / No issues
                                                            </option>
                                                            <option value="needs_repair">
                                                                Needs Repair
                                                            </option>
                                                            <option value="requires_followup">
                                                                Requires
                                                                Follow-up
                                                            </option>
                                                            <option value="not_applicable">
                                                                Not Applicable
                                                            </option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium">
                                                        Remark
                                                    </label>
                                                    <textarea
                                                        value={reviewNote}
                                                        onChange={(e) =>
                                                            setReviewNote(
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="w-full border p-2 rounded mt-1"
                                                        rows={3}
                                                        placeholder="Optional note for the passenger or record"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        className="px-3 py-2 bg-green-600 text-white rounded"
                                                        onClick={() =>
                                                            handleStaffAction(
                                                                "approve",
                                                            )
                                                        }
                                                    >
                                                        Approve & Complete
                                                    </button>
                                                    <button
                                                        className="px-3 py-2 bg-red-600 text-white rounded"
                                                        onClick={() =>
                                                            handleStaffAction(
                                                                "reject",
                                                            )
                                                        }
                                                    >
                                                        Reject
                                                    </button>
                                                    <button
                                                        className="px-3 py-2 bg-yellow-600 text-black rounded"
                                                        onClick={() =>
                                                            handleStaffAction(
                                                                "reassign",
                                                            )
                                                        }
                                                    >
                                                        Reassign
                                                    </button>
                                                </div>
                                            </>
                                        ) : workOrder?.assignedTo?.role?.key ===
                                          "passenger" ? (
                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                                                This order is now in the hands
                                                of the assigned passenger.
                                                Please wait until the passenger
                                                completes it and submits it for
                                                review. Approval actions will
                                                become available afterward.
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900">
                                                The booking is now at the hand
                                                of the passenger. Wait until the
                                                passenger completes it and
                                                submits it for review.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            {totalSections > 1 ? (
                <div className="md:hidden">
                    <button
                        className="fixed left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-40 w-10 h-10 rounded-full text-white shadow flex items-center justify-center bg-primary"
                        onClick={() =>
                            setActiveSection((s) => Math.max(0, s - 1))
                        }
                        disabled={activeSection === 0}
                        aria-label="Previous section"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="15 6 9 12 15 18" />
                        </svg>
                    </button>
                    {activeSection < totalSections - 1 ? (
                        <button
                            className="fixed right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-40 w-10 h-10 rounded-full text-white shadow flex items-center justify-center bg-primary"
                            onClick={() =>
                                setActiveSection((s) =>
                                    Math.min(totalSections - 1, s + 1),
                                )
                            }
                            aria-label="Next section"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="24"
                                height="24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="9 6 15 12 9 18" />
                            </svg>
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
