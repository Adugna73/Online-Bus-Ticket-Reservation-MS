"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export default function MaintenanceChecklist({
    template,
    workOrderId,
}: {
    template: any;
    workOrderId?: string;
}) {
    const { data: session } = useSession();
    const [items, setItems] = useState<any[]>(template.items || []);
    const [stations, setSites] = useState<any[]>([]);
    const [siteId, setSiteId] = useState<string | null>(null);
    const [title, setTitle] = useState(
        template.name || "Maintenance Booking",
    );
    const [workOrder, setWorkOrder] = useState<any>(null);
    // Toggle to disable location checks via .env (client)
    const DISABLE_LOCATION_TRACKER =
        typeof process !== "undefined" &&
        process.env.NEXT_PUBLIC_DISABLE_LOCATION_CHECKIN === "true";

    const [locationStatus, setLocationStatus] = useState<{
        checkedIn: boolean;
        checkedOut: boolean;
        locationVerified: boolean;
        message: string;
    }>(() => ({
        checkedIn: false,
        checkedOut: false,
        locationVerified: DISABLE_LOCATION_TRACKER ? true : false,
        message: DISABLE_LOCATION_TRACKER
            ? "Location verification disabled"
            : "",
    }));
    const [saving, setSaving] = useState(false);
    // image viewer for attachments
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerAttachments, setViewerAttachments] = useState<string[]>([]);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [viewerMinimal, setViewerMinimal] = useState(false);
    const [viewerItemIdx, setViewerItemIdx] = useState<number | null>(null);
    // full-page overlay for maintenance viewer
    const [fullPageOpen, setFullPageOpen] = useState(false);
    const [fullPageUrl, setFullPageUrl] = useState<string | null>(null);
    // Expand checklist height while attaching files (keeps whole checklist visible)
    const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);
    const openFullPage = (url?: string) => {
        setFullPageUrl(url ?? viewerAttachments[viewerIndex] ?? null);
        setFullPageOpen(true);
    };
    const closeFullPage = () => setFullPageOpen(false);

    function openImageViewer(urls: string[], index = 0, minimal = false, itemIdx: number | null = null) {
        const list = (urls || []).map((u: any) => (typeof u === "string" ? u : u?.url)).filter(Boolean);
        if (!list.length) return;
        setViewerAttachments(list);
        setViewerIndex(Math.max(0, Math.min(index, list.length - 1)));
        setViewerMinimal(!!minimal);
        setViewerItemIdx(itemIdx);
        setViewerOpen(true);
    }

    useEffect(() => {
        (async () => {
            const r = await fetch("/api/stations");
            if (r.ok) setSites(await r.json());
        })();
    }, []);

    useEffect(() => {
        if (workOrderId) {
            (async () => {
                const r = await fetch(`/api/workorders/${workOrderId}`);
                if (r.ok) {
                    const data = await r.json();
                    setWorkOrder(data);
                    setLocationStatus({
                        checkedIn: !!data.checkInTime,
                        checkedOut: !!data.checkOutTime,
                        locationVerified: DISABLE_LOCATION_TRACKER
                            ? true
                            : data.locationVerified || false,
                        message: DISABLE_LOCATION_TRACKER
                            ? "Location verification disabled"
                            : data.locationVerified
                              ? "Location verified"
                              : "Location not verified",
                    });
                    if (data.checklist) setItems(data.checklist.items || []);
                }
            })();
        }
    }, [workOrderId]);

    const fileToDataUrl = (file: File) =>
        new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });

    const uploadAttachment = async (index: number, file: File) => {
        if (!workOrderId) return alert("Please create a booking first");
        try {
            const dataUrl = await fileToDataUrl(file);
            const r = await fetch("/api/checklist/attachments", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    workOrderId,
                    itemIndex: index,
                    fileName: file.name,
                    mimeType: file.type,
                    data: dataUrl,
                }),
            });
            if (!r.ok) throw new Error("upload failed");
            const json = await r.json();
            const url = json.url;
            setItems((cur) =>
                cur.map((it, i) =>
                    i === index
                        ? {
                              ...it,
                              attachments: [...(it.attachments || []), url],
                          }
                        : it,
                ),
            );
            setAttachmentsExpanded(false);
            // clear native file input so the same file can be re-selected
            try {
                const el = document.getElementById(`maintenance-attach-${index}`) as HTMLInputElement | null;
                if (el) el.value = "";
            } catch (err) {
                /* ignore */
            }
        } catch (e) {
            console.error(e);
            alert("Upload failed");
        }
    };

    const changeFinding = (index: number, finding: string) => {
        setItems((cur) =>
            cur.map((it, i) => (i === index ? { ...it, finding } : it)),
        );
    };

    const setRemark = (index: number, remark: string) => {
        setItems((cur) =>
            cur.map((it, i) => (i === index ? { ...it, remark } : it)),
        );
    };

    const approveItem = (index: number) => {
        setItems((cur) =>
            cur.map((it, i) => (i === index ? { ...it, approved: true } : it)),
        );
    };

    const save = async () => {
        if (!DISABLE_LOCATION_TRACKER) {
            if (!workOrderId && !locationStatus.checkedIn) {
                alert(
                    "You must check in at the site location before starting work",
                );
                return;
            }

            if (!locationStatus.locationVerified) {
                alert(
                    "Your location must be verified before you can submit the checklist. Please ensure you are at the correct site.",
                );
                return;
            }
        }

        setSaving(true);
        try {
            let woId = workOrderId;
            if (!woId) {
                // create booking
                if (!siteId) return alert("Please select a site");
                const r = await fetch("/api/workorders", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        title,
                        description: template.description || "",
                        type: "pm",
                        planned: true,
                        siteId,
                    }),
                });
                if (!r.ok) {
                    alert("Failed to create booking");
                    setSaving(false);
                    return;
                }
                const created = await r.json();
                woId = created.id;
            }
            // save checklist
            const r2 = await fetch(`/api/workorders/${woId}/checklist`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ items }),
            });
            if (!r2.ok) {
                alert("Failed saving checklist");
            } else {
                alert("Checklist saved");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving");
        }
        setSaving(false);
    };

    const handleLocationCheck = async (action: "checkin" | "checkout") => {
        if (!workOrderId) return alert("No booking selected");

        try {
            // Get current location
            if (!navigator.geolocation) {
                alert("Geolocation is not supported by this browser");
                return;
            }

            const position = await new Promise<GeolocationPosition>(
                (resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 300000, // 5 minutes
                    });
                },
            );

            const { latitude, longitude } = position.coords;

            const response = await fetch(
                `/api/workorders/${workOrderId}/checkin`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action,
                        latitude: latitude.toString(),
                        longitude: longitude.toString(),
                    }),
                },
            );

            const result = await response.json();

            if (response.ok) {
                setLocationStatus({
                    checkedIn:
                        action === "checkin" ? true : locationStatus.checkedIn,
                    checkedOut:
                        action === "checkout"
                            ? true
                            : locationStatus.checkedOut,
                    locationVerified: result.locationVerified,
                    message: result.message,
                });
                alert(
                    `${
                        action === "checkin" ? "Checked in" : "Checked out"
                    } successfully! ${result.message}`,
                );
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error: any) {
            console.error("Location error:", error);
            alert(`Location error: ${error.message}`);
        }
    };

    const groupedByCategory = items.reduce((acc: any, it: any, idx: number) => {
        const cat = it.category || "General";
        acc[cat] = acc[cat] || [];
        acc[cat].push({ ...it, __index: idx });
        return acc;
    }, {});

    return (
        <div className={`bg-white p-4 rounded shadow space-y-4 ${attachmentsExpanded ? 'max-h-[95vh] overflow-auto transition-all' : ''}`}>
            <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogTitle className="sr-only">Image viewer</DialogTitle>
                    <div className="flex flex-col items-center gap-4">
                        {viewerAttachments && viewerAttachments.length ? (
                            <img src={viewerAttachments[viewerIndex]} alt={`attachment-${viewerIndex + 1}`} className="max-h-[70vh] w-full object-contain" />
                        ) : null}
                        {viewerMinimal ? (
                            <div className="mt-3">
                                <button className="px-3 py-2 rounded bg-white text-sm" onClick={() => setViewerOpen(false)}>
                                    Close
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button className="px-3 py-1 rounded border bg-background text-sm" onClick={() => setViewerIndex((v) => Math.max(0, v - 1))} disabled={viewerIndex === 0}>
                                    Prev
                                </button>
                                <a className="px-3 py-1 rounded border bg-background text-sm underline" href={viewerAttachments[viewerIndex] || "#"} target="_blank" rel="noreferrer">
                                    Open
                                </a>
                                <button className="px-3 py-1 rounded border bg-background text-sm" onClick={() => openFullPage()}>
                                    Full page
                                </button>
                                <a className="px-3 py-1 rounded border bg-background text-sm underline" href={viewerAttachments[viewerIndex] || "#"} download>
                                    Download
                                </a>
                                <button className="px-3 py-1 rounded border bg-background text-sm" onClick={() => setViewerIndex((v) => Math.min((viewerAttachments || []).length - 1, v + 1))} disabled={viewerIndex >= (viewerAttachments || []).length - 1}>
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {fullPageOpen && fullPageUrl ? (
                <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center">
                    <button
                        className="absolute right-4 top-4 z-50 px-3 py-2 rounded bg-white text-sm"
                        onClick={closeFullPage}
                    >
                        Close
                    </button>
                    <img src={fullPageUrl} alt="full-size" className="max-h-[100vh] max-w-[100vw] object-contain" />
                </div>
            ) : null}

            {/* GPS Check-in/Check-out Section */}
            {workOrderId && !DISABLE_LOCATION_TRACKER && (
                <div className="bg-blue-50 p-4 rounded border border-blue-200">
                    <h3 className="font-semibold mb-3">Location Check-in</h3>
                    <div className="flex gap-4 items-center mb-3">
                        <button
                            onClick={() => handleLocationCheck("checkin")}
                            disabled={locationStatus.checkedIn}
                            className={`px-4 py-2 rounded ${
                                locationStatus.checkedIn
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-green-600 text-white hover:bg-green-700"
                            }`}
                        >
                            {locationStatus.checkedIn
                                ? "Checked In"
                                : "Check In"}
                        </button>
                        <button
                            onClick={() => handleLocationCheck("checkout")}
                            disabled={
                                !locationStatus.checkedIn ||
                                locationStatus.checkedOut
                            }
                            className={`px-4 py-2 rounded ${
                                !locationStatus.checkedIn ||
                                locationStatus.checkedOut
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-red-600 text-white hover:bg-red-700"
                            }`}
                        >
                            {locationStatus.checkedOut
                                ? "Checked Out"
                                : "Check Out"}
                        </button>
                    </div>
                    <div className="text-sm">
                        <div
                            className={`font-medium ${
                                locationStatus.locationVerified
                                    ? "text-green-600"
                                    : "text-red-600"
                            }`}
                        >
                            Status: {locationStatus.message}
                        </div>
                        {workOrder?.site && (
                            <div className="mt-2">
                                <strong>Site Location:</strong>{" "}
                                {workOrder.site.latitude},{" "}
                                {workOrder.site.longitude}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <div className="text-sm font-semibold mb-2">Site</div>
                    <select
                        value={siteId || ""}
                        onChange={(e) => setSiteId(e.target.value || null)}
                        className="w-full"
                    >
                        <option value="">Select site</option>
                        {stations.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name} ({s.siteCode})
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <div className="text-sm font-semibold mb-2">Title</div>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full"
                    />
                </div>
            </div>

            <div>
                <div className="font-semibold mb-2">Checklist Items</div>
                <div className="space-y-3">
                    {Object.keys(groupedByCategory).map((category) => (
                        <div key={category}>
                            <div className="text-md font-semibold mb-2">
                                {category}
                            </div>
                            <div className="space-y-3">
                                {groupedByCategory[category].map((it: any) => (
                                    <div
                                        key={it.__index}
                                        className="p-3 border rounded grid grid-cols-1 md:flex md:items-start md:gap-4"
                                    >
                                        <div className="md:flex-1 md:min-w-0">
                                            <div className="font-medium">
                                                {it.no}. {it.task}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                {it.possibleAction}
                                            </div>
                                            <div className="mt-2 text-xs flex gap-3">
                                                <div className="px-2 py-0.5 rounded bg-gray-100">
                                                    {it.checklistLevel}
                                                </div>
                                                {it.attachment &&
                                                    it.attachment !==
                                                        "Not Required" && (
                                                        <div className="px-2 py-0.5 rounded bg-yellow-100">
                                                            Attachment: {" "}
                                                            {it.attachment}
                                                        </div>
                                                    )}
                                            </div>
                                            <div className="text-sm text-gray-600 mt-2">
                                                {it.remark}
                                            </div>
                                        </div>
                                        <div className="mt-2 md:mt-0 md:w-48 space-y-2">
                                            <select
                                                value={it.finding || ""}
                                                onChange={(e) =>
                                                    changeFinding(
                                                        it.__index,
                                                        e.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    Select finding
                                                </option>
                                                {(it.findings || []).map(
                                                    (f: string) => (
                                                        <option
                                                            key={f}
                                                            value={f}
                                                        >
                                                            {f}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                            <input
                                                placeholder="Remark"
                                                value={it.remark || ""}
                                                onChange={(e) =>
                                                    setRemark(
                                                        it.__index,
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                            {/* Attachment input */}
                                            <div>
                                                <input
                                                    id={`maintenance-attach-${it.__index}`}
                                                    type="file"
                                                    accept="image/*"
                                                    onFocus={() => setAttachmentsExpanded(true)}
                                                    onClick={() => setAttachmentsExpanded(true)}
                                                    onTouchStart={() => setAttachmentsExpanded(true)}
                                                    onChange={(e) => {
                                                        const f =
                                                            e.target.files?.[0];
                                                        if (f)
                                                            uploadAttachment(
                                                                it.__index,
                                                                f,
                                                            );
                                                    }}
                                                />
                                                <div className="flex gap-2 mt-2">
                                                    {(it.attachments || []).map((a: string, ai: number) => {
                                                            const urls = (it.attachments || []).map((x: any) => (typeof x === 'string' ? x : x?.url));
                                                            return (
                                                                <div key={ai} className="flex items-center gap-2">
                                                                    <img
                                                                        src={a}
                                                                        alt={"attachment-" + ai}
                                                                        className="w-20 h-12 object-cover border"
                                                                    />
                                                                    {!viewerOpen || viewerItemIdx !== it.__index ? (
                                                                        <button className="px-2 py-1 text-sm rounded border" onClick={() => openImageViewer(urls, ai, true, it.__index)}>
                                                                            View
                                                                        </button>
                                                                    ) : null}
                                                                </div>
                                                            );
                                                        })} 
                                                    {(session?.user as any)
                                                        ?.role ===
                                                        "Staff" ||
                                                    (session?.user as any)
                                                        ?.role === "Manager" ? (
                                                        <div>
                                                            <button
                                                                className="px-2 py-1 bg-green-500 text-white rounded"
                                                                onClick={() =>
                                                                    approveItem(
                                                                        it.__index,
                                                                    )
                                                                }
                                                            >
                                                                Approve
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="pt-2">
                <button className="ossBtn" onClick={save} disabled={saving}>
                    {saving ? "Saving..." : "Create / Save Booking"}
                </button>
            </div>
        </div>
    );
}
