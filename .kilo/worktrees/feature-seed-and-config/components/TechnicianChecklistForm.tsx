"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Attachment = {
    url: string;
    fileName?: string;
    uploading?: boolean;
    progress?: number;
    error?: string;
};

type ChecklistItem = {
    category: string;
    label: string;
    requiredPhoto?: boolean;
    action?: string; // selected action
    findings?: string[];
    remark?: string;
    attachments?: Attachment[]; // urls + metadata
};

export default function PassengerChecklistForm({
    workOrderId,
    initialItems,
    checklistScope,
    onSaved,
    enableStepNav = true,
    view = "all",
}: {
    workOrderId: string;
    initialItems?: ChecklistItem[];
    checklistScope?: string;
    onSaved?: () => void;
    enableStepNav?: boolean;
    view?: "all" | "checkin" | "items";
}) {
    // Toggle to disable any background/location-tracking feature via .env (client)
    const DISABLE_LOCATION_TRACKER =
        typeof process !== "undefined" &&
        process.env &&
        process.env.NEXT_PUBLIC_DISABLE_LOCATION_CHECKIN === "true";

    // When disabled, mark verified so checklist opens without check-in
    useEffect(() => {
        if (DISABLE_LOCATION_TRACKER) setLocationVerified(true);
    }, [DISABLE_LOCATION_TRACKER]);

    const [items, setItems] = useState<ChecklistItem[]>(() => {
        if (initialItems && initialItems.length) {
            // normalize attachments to Attachment objects if they are strings
            return initialItems.map((it: any) => ({
                ...it,
                attachments: (it.attachments || []).map((a: any) =>
                    typeof a === "string"
                        ? { url: a, fileName: a.split("/").pop() }
                        : a,
                ),
            }));
        }
        return getDefaultItems(checklistScope);
    });
    const [lat, setLat] = useState<string | null>(null);
    const [lon, setLon] = useState<string | null>(null);
    const [siteLat, setSiteLat] = useState<number | null>(null);
    const [siteLon, setSiteLon] = useState<number | null>(null);
    const [hasServerCheckIn, setHasServerCheckIn] = useState(false);
    const [locationVerified, setLocationVerified] = useState(false);
    const [checkingIn, setCheckingIn] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<"error" | "success" | null>(
        null,
    );
    const [checkInMessage, setCheckInMessage] = useState<string | null>(null);
    const [checkInMessageType, setCheckInMessageType] = useState<
        "error" | "success" | null
    >(null);
    const checkInMessageTimeoutRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null);
    const [distanceMeters, setDistanceMeters] = useState<number | null>(null);

    // image viewer for attachments
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerAttachments, setViewerAttachments] = useState<string[]>([]);
    const [viewerIndex, setViewerIndex] = useState(0);
    // Minimal viewer mode (used when opened via the 'View' button)
    const [viewerMinimal, setViewerMinimal] = useState(false);
    // Which checklist item index is currently being viewed (so we can hide inline buttons)
    const [viewerItemIdx, setViewerItemIdx] = useState<number | null>(null);
    // Full-page image overlay state
    const [fullPageOpen, setFullPageOpen] = useState(false);
    const [fullPageUrl, setFullPageUrl] = useState<string | null>(null);

    function openImageViewer(
        urls: string[],
        index = 0,
        itemIdx: number | null = null,
        minimal = false,
    ) {
        const list = (urls || [])
            .map((u: any) => (typeof u === "string" ? u : u?.url))
            .filter(Boolean);
        if (!list.length) return;
        setViewerAttachments(list);
        setViewerIndex(Math.max(0, Math.min(index, list.length - 1)));
        setViewerItemIdx(itemIdx);
        setViewerMinimal(!!minimal);
        setViewerOpen(true);
    }
    const viewerPrev = () => setViewerIndex((v: number) => Math.max(0, v - 1));
    const viewerNext = () =>
        setViewerIndex((v: number) =>
            Math.min((viewerAttachments || []).length - 1, v + 1),
        );
    const openFullPage = (url?: string) => {
        setFullPageUrl(url ?? viewerAttachments[viewerIndex] ?? null);
        setFullPageOpen(true);
    };
    const closeFullPage = () => setFullPageOpen(false);

    // UI navigation / focus state
    const [currentStep, setCurrentStep] = useState(0);
    const [showStepNav, setShowStepNav] = useState(false);
    const [isMobileView, setIsMobileView] = useState<boolean>(false);
    // Expand checklist height while attaching files (keeps other items visible)
    const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);

    const stepScrollRef = useRef<HTMLDivElement | null>(null);
    const checklistTopRef = useRef<HTMLDivElement | null>(null);
    const firstIncompleteRef = useRef<HTMLDivElement | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    // track small-screen viewport so desktop vs mobile behaviors can differ
    useEffect(() => {
        const mq =
            typeof window !== "undefined"
                ? window.matchMedia("(max-width: 767px)")
                : null;
        const set = () => setIsMobileView(!!mq && mq.matches);
        if (mq) {
            set();
            // listen for changes
            const handler = (ev: MediaQueryListEvent) =>
                setIsMobileView(ev.matches);
            if (mq.addEventListener) mq.addEventListener("change", handler);
            else mq.addListener(handler as any);
            return () => {
                if (mq.removeEventListener)
                    mq.removeEventListener("change", handler as any);
                else mq.removeListener(handler as any);
            };
        }
        return;
    }, []);

    // if the focused item loses attachments, clear focus
    // (removed focused-item auto-clear — mobile no longer collapses items)

    function updateItem(idx: number, patch: Partial<ChecklistItem>) {
        setItems((cur) =>
            cur.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
        );
    }

    function setItemAttachments(idx: number, atts: Attachment[]) {
        setItems((cur) =>
            cur.map((it, i) => (i === idx ? { ...it, attachments: atts } : it)),
        );
    }

    // Programmatically open the hidden file input as a robust fallback (some browsers/devices
    // won't trigger the native file dialog on label-only clicks). This also centers the item.
    function openAttachPicker(idx: number) {
        try {
            const el = document.getElementById(
                `attach-files-${idx}`,
            ) as HTMLInputElement | null;
            if (el) {
                el.click();
                setAttachmentsExpanded(true);
                setTimeout(() => {
                    const container = stepScrollRef.current;
                    const itemEl = container?.querySelector(
                        `[data-item-idx="${idx}"]`,
                    ) as HTMLElement | null;
                    if (itemEl)
                        itemEl.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                        });
                }, 30);
            }
        } catch (e) {
            /* ignore */
        }
    }

    const categories = useMemo(() => {
        const seen = new Set<string>();
        const list: string[] = [];
        for (const it of items) {
            const key = (it.category || "Other").trim() || "Other";
            if (!seen.has(key)) {
                seen.add(key);
                list.push(key);
            }
        }
        return list.length ? list : ["Checklist"];
    }, [items]);

    const currentCategory = categories[currentStep] || categories[0];
    const itemsForCategory = useMemo(
        () =>
            items
                .map((it, idx) => ({ it, idx }))
                .filter(
                    ({ it }) =>
                        (it.category || "Other").trim() === currentCategory,
                ),
        [items, currentCategory],
    );

    useEffect(() => {
        if (currentStep >= categories.length) {
            setCurrentStep(Math.max(0, categories.length - 1));
        }
    }, [categories.length, currentStep]);

    const firstIncompleteLocalIndex = useMemo(() => {
        const idx = itemsForCategory.findIndex(({ it }) => !it.action);
        return idx === -1 ? 0 : idx;
    }, [itemsForCategory]);

    useEffect(() => {
        // Only auto-scroll when switching category steps.
        // Avoid jumping while the passenger is filling action/remark/attachments.
        if (!stepScrollRef.current) return;
        const container = stepScrollRef.current;
        const target = firstIncompleteRef.current;
        if (!target) {
            container.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const nextTop =
            targetRect.top - containerRect.top + container.scrollTop - 8;
        container.scrollTo({
            top: Math.max(0, nextTop),
            behavior: "smooth",
        });
    }, [currentStep]);

    useEffect(() => {
        if (!enableStepNav || !locationVerified || !checklistTopRef.current) {
            setShowStepNav(false);
            return;
        }
        const el = checklistTopRef.current;
        const observer = new IntersectionObserver(
            ([entry]) => setShowStepNav(entry.isIntersecting),
            { threshold: 0.2 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [enableStepNav, locationVerified]);

    // When the attachments input is expanded, keep the user's current scroll
    // position instead of forcing the checklist to the bottom. This avoids
    // jarring jumps on mobile when interacting with actions or attachments.
    useEffect(() => {
        if (!attachmentsExpanded) return;
        if (!stepScrollRef.current) return;
        // Intentionally no auto-scroll here.
    }, [attachmentsExpanded, currentStep]);

    async function uploadChecklistFiles(
        files: FileList | File[],
        itemIndex: number,
    ) {
        const fileArray = Array.from(files as any as File[]);
        for (const f of fileArray) {
            // add placeholder attachment
            const placeholder: Attachment = {
                url: "",
                fileName: f.name,
                uploading: true,
                progress: 0,
            };
            const curAtts = items[itemIndex].attachments || [];
            setItemAttachments(itemIndex, [...curAtts, placeholder]);
            const attPos = (items[itemIndex].attachments || []).length;
            try {
                const base64 = await fileToBase64(f);
                const url = await uploadWithProgress(
                    base64,
                    f.name,
                    f.type,
                    itemIndex,
                    (p: number) => {
                        // update progress
                        setItems((cur) =>
                            cur.map((it, i) => {
                                if (i !== itemIndex) return it;
                                const atts = (it.attachments || []).slice();
                                const a = atts[attPos] || atts[atts.length - 1];
                                if (a) a.progress = p;
                                return { ...it, attachments: atts };
                            }),
                        );
                    },
                );
                // replace placeholder with real url
                setItems((cur) =>
                    cur.map((it, i) => {
                        if (i !== itemIndex) return it;
                        const atts = (it.attachments || []).slice();
                        // find first placeholder matching fileName and uploading
                        const idx = atts.findIndex(
                            (x) => x.uploading && x.fileName === f.name,
                        );
                        if (idx >= 0)
                            atts[idx] = {
                                url,
                                fileName: f.name,
                                uploading: false,
                                progress: 100,
                            };
                        else
                            atts.push({
                                url,
                                fileName: f.name,
                                uploading: false,
                                progress: 100,
                            });
                        return { ...it, attachments: atts };
                    }),
                );
                // keep desktop-like behavior on mobile: DO NOT collapse other items.
                try {
                    // switch to the item's category (if not already) so the uploaded item is visible
                    const itemCat =
                        (
                            (items[itemIndex] && items[itemIndex].category) ||
                            "Other"
                        ).trim() || "Other";
                    const catIdx = categories.indexOf(itemCat);
                    if (catIdx >= 0) setCurrentStep(catIdx);
                    // scroll the checklist container so the uploaded item / preview is visible
                    setTimeout(() => {
                        const container = stepScrollRef.current;
                        if (!container) return;
                        // try to scroll the uploaded item into view (prefer this over scrolling to the very bottom)
                        const itemEl = container.querySelector(
                            `[data-item-idx="${itemIndex}"]`,
                        ) as HTMLElement | null;
                        if (itemEl) {
                            // center the item to avoid it being hidden under sticky headers
                            itemEl.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                            });
                        } else {
                            container.scrollTo({
                                top: container.scrollHeight,
                                behavior: "smooth",
                            });
                        }
                    }, 120);
                } catch (e) {
                    /* ignore */
                }
            } catch (err: any) {
                // mark error on last placeholder
                setItems((cur) =>
                    cur.map((it, i) => {
                        if (i !== itemIndex) return it;
                        const atts = (it.attachments || []).slice();
                        const idx = atts.findIndex(
                            (x) => x.uploading && x.fileName === f.name,
                        );
                        if (idx >= 0)
                            atts[idx] = {
                                url: "",
                                fileName: f.name,
                                uploading: false,
                                progress: 0,
                                error: err?.message || "upload failed",
                            };
                        return { ...it, attachments: atts };
                    }),
                );
            }
        }
        // collapse the expanded attachment state after uploads finish
        setAttachmentsExpanded(false);
        // clear the native file input so the same file can be re-selected immediately
        try {
            const inputEl = document.getElementById(
                `attach-files-${itemIndex}`,
            ) as HTMLInputElement | null;
            if (inputEl) inputEl.value = "";
        } catch (e) {
            /* ignore */
        }
    }

    function uploadWithProgress(
        base64: string,
        fileName: string,
        mimeType: string,
        itemIndex: number,
        onProgress: (p: number) => void,
    ) {
        return new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "/api/checklist/attachments");
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.upload.onprogress = (ev) => {
                if (ev.lengthComputable) {
                    const percent = Math.round((ev.loaded / ev.total) * 100);
                    onProgress(percent);
                }
            };
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const json = JSON.parse(xhr.responseText);
                            if (json.url) resolve(json.url);
                            else reject(new Error(json?.error || "no url"));
                        } catch (e) {
                            reject(e);
                        }
                    } else {
                        reject(new Error("upload failed: " + xhr.status));
                    }
                }
            };
            xhr.onerror = () => reject(new Error("network error"));
            const payload = JSON.stringify({
                workOrderId,
                itemIndex,
                fileName,
                mimeType,
                data: base64,
            });
            xhr.send(payload);
        });
    }

    async function handleCheckIn() {
        setCheckingIn(true);
        setMessage(null);
        if (siteLat == null || siteLon == null) {
            setMessage(
                "Site coordinates are missing. Contact your supervisor.",
            );
            setCheckingIn(false);
            return;
        }
        if (!navigator.geolocation) {
            setMessage("Geolocation not supported by browser");
            setCheckingIn(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const latStr = String(pos.coords.latitude);
                const lonStr = String(pos.coords.longitude);
                const distance = haversineMeters(
                    siteLat,
                    siteLon,
                    pos.coords.latitude,
                    pos.coords.longitude,
                );
                setDistanceMeters(distance);
                setLat(latStr);
                setLon(lonStr);
                if (distance > 100) {
                    setMessage(
                        `You are ${Math.round(
                            distance,
                        )}m away. Go to the site and try again.`,
                    );
                    setCheckingIn(false);
                    return;
                }
                // Persist check-in immediately so supervisors can see coordinates
                try {
                    const patchBody: any = {
                        passengerLatitude: latStr,
                        passengerLongitude: lonStr,
                        checkInTime: new Date().toISOString(),
                        status: "in_progress",
                        locationVerified: true,
                    };
                    const r = await fetch(`/api/workorders/${workOrderId}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify(patchBody),
                    });
                    if (!r.ok) {
                        const t = await r.text().catch(() => "");
                        console.warn("Failed saving check-in:", r.status, t);
                        setMessage(
                            "Location captured (not saved): server error",
                        );
                    } else {
                        setHasServerCheckIn(true);
                        setLocationVerified(true);
                        setCheckInMessage("Check-in verified");
                        setCheckInMessageType("success");
                        toast({
                            title: "Check-in verified",
                            variant: "success",
                        });
                        // remove the check-in popup message after 10s
                        if (checkInMessageTimeoutRef.current) {
                            clearTimeout(checkInMessageTimeoutRef.current);
                        }
                        checkInMessageTimeoutRef.current = setTimeout(() => {
                            setCheckInMessage(null);
                            setCheckInMessageType(null);
                            checkInMessageTimeoutRef.current = null;
                        }, 10000);
                    }
                } catch (err: any) {
                    console.error("Error saving check-in:", err);
                    setCheckInMessage("Location captured (save failed)");
                    setCheckInMessageType("error");
                    if (checkInMessageTimeoutRef.current) {
                        clearTimeout(checkInMessageTimeoutRef.current);
                    }
                    checkInMessageTimeoutRef.current = setTimeout(() => {
                        setCheckInMessage(null);
                        setCheckInMessageType(null);
                        checkInMessageTimeoutRef.current = null;
                    }, 10000);
                } finally {
                    setCheckingIn(false);
                }
            },
            (err) => {
                setCheckInMessage("Could not get location: " + err.message);
                setCheckInMessageType("error");
                setCheckingIn(false);
                if (checkInMessageTimeoutRef.current) {
                    clearTimeout(checkInMessageTimeoutRef.current);
                }
                checkInMessageTimeoutRef.current = setTimeout(() => {
                    setCheckInMessage(null);
                    setCheckInMessageType(null);
                    checkInMessageTimeoutRef.current = null;
                }, 10000);
            },
            { enableHighAccuracy: true, timeout: 20000 },
        );
    }

    useEffect(() => {
        // Load existing booking check-in if present so Complete becomes enabled
        (async () => {
            try {
                const r = await fetch(`/api/workorders/${workOrderId}`);
                if (r.ok) {
                    const j = await r.json();
                    if (j?.passengerLatitude || j?.passengerLongitude) {
                        if (j.passengerLatitude)
                            setLat(String(j.passengerLatitude));
                        if (j.passengerLongitude)
                            setLon(String(j.passengerLongitude));
                        setHasServerCheckIn(true);
                    } else if (j?.checkInTime) {
                        // checkInTime exists but coords missing — treat as check-in present
                        setHasServerCheckIn(true);
                    }
                    if (j?.locationVerified) {
                        setLocationVerified(true);
                    }
                    if (j?.site?.latitude && j?.site?.longitude) {
                        const sLat = Number(j.site.latitude);
                        const sLon = Number(j.site.longitude);
                        if (Number.isFinite(sLat)) setSiteLat(sLat);
                        if (Number.isFinite(sLon)) setSiteLon(sLon);
                    }
                }
            } catch (e) {
                // ignore
            }
        })();
    }, [workOrderId]);

    useEffect(() => {
        return () => {
            if (checkInMessageTimeoutRef.current) {
                clearTimeout(checkInMessageTimeoutRef.current);
            }
        };
    }, []);

    async function handleSubmit(completed = false, redirect = false) {
        console.debug("handleSubmit", { completed, lat, lon, items });
        setSaving(true);
        setMessage(null);
        if (!locationVerified) {
            setMessage("Please check in at the site before continuing.");
            setSaving(false);
            return;
        }
        // When finalizing, validate the entire checklist; when "Save & continue later" only validate the current category.
        const itemsToValidate = completed
            ? items
            : items.filter(
                  (it) =>
                      ((it.category || "Other").trim() || "Other") ===
                      currentCategory,
              );

        // Validate required photos for the relevant items (not the full list when saving a single category)
        for (let i = 0; i < itemsToValidate.length; i++) {
            const it = itemsToValidate[i];
            const atts = (
                Array.isArray(it.attachments) ? it.attachments : []
            ) as Attachment[];
            const uploadedUrls = atts.filter(
                (a) => !!(a && (a as any).url),
            ).length;
            if (it.requiredPhoto && uploadedUrls === 0) {
                setMessage(`Photo required for: ${it.label}`);
                setSaving(false);
                return;
            }
        }

        // Allow completion without check-in coordinates; prefer having them but do not block

        // Prevent submit if any uploads still in progress for the items being saved
        for (let i = 0; i < itemsToValidate.length; i++) {
            const atts = (
                Array.isArray(itemsToValidate[i].attachments)
                    ? itemsToValidate[i].attachments
                    : []
            ) as Attachment[];
            if (atts.some((a) => a && (a as any).uploading)) {
                setMessage(
                    "Please wait for file uploads to finish before saving.",
                );
                setSaving(false);
                return;
            }
        }

        try {
            // Normalize attachments to string URLs before sending
            const payloadItems = items.map((it) => {
                const atts = (
                    Array.isArray(it.attachments) ? it.attachments : []
                ) as Attachment[];
                const urls = atts
                    .map((a) =>
                        typeof a === "string"
                            ? a
                            : (a?.url ?? (a as any)?.fileUrl),
                    )
                    .filter(Boolean);
                return { ...it, attachments: urls };
            });

            // Save checklist items via API
            const r = await fetch(`/api/workorders/${workOrderId}/checklist`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    items: payloadItems,
                    finalize: !!completed,
                }),
            });
            if (!r.ok) {
                const text = await r.text().catch(() => "");
                console.error("Checklist save failed:", r.status, text);
                throw new Error("Failed saving checklist");
            }

            // Update booking with check-in coords and optionally set status
            const patchBody: any = {};
            if (lat && lon) {
                patchBody.passengerLatitude = lat;
                patchBody.passengerLongitude = lon;
                patchBody.checkInTime = new Date().toISOString();
            }
            if (completed) {
                // Mark as under review and reassign to the passenger's immediate supervisor if available
                patchBody.status = "under_review";
                try {
                    const sess = await getSession();
                    const userId = sess?.user?.id;
                    if (userId) {
                        const ru = await fetch(`/api/users/${userId}`);
                        if (ru.ok) {
                            const userJson = await ru.json();
                            const sup = userJson?.immediateStaff;
                            if (sup && sup.id) {
                                patchBody.assignedToId = sup.id;
                            }
                        }
                    }
                } catch (e) {
                    // ignore and continue without reassign
                }
            } else {
                patchBody.status = "in_progress";
            }
            const rp = await fetch(`/api/workorders/${workOrderId}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(patchBody),
            });
            if (!rp.ok) {
                const text = await rp.text().catch(() => "");
                console.error("Failed updating workorder", rp.status, text);
                setMessage("Failed updating workorder: " + (text || rp.status));
                toast({
                    title: "Failed to update booking",
                    description: text || `Status ${rp.status}`,
                    variant: "destructive",
                });
                throw new Error("Failed updating workorder");
            }

            setMessage("Checklist saved");
            setMessageType("success");
            // clear inline message after 5s to match toast behavior
            setTimeout(() => {
                setMessage(null);
                setMessageType(null);
            }, 5000);
            toast({
                title: "Checklist saved",
                description: "Booking marked under review",
                variant: "success",
            });
            if (onSaved) onSaved();
            if (completed) {
                // give toast a moment then redirect passenger to their workorders list
                setTimeout(() => router.replace("/passenger/bookings"), 800);
            } else if (redirect) {
                if (currentStep < categories.length - 1) {
                    setCurrentStep((s) =>
                        Math.min(categories.length - 1, s + 1),
                    );
                    // briefly scroll checklist to top of next category
                    setTimeout(() => {
                        stepScrollRef.current?.scrollTo({
                            top: 0,
                            behavior: "smooth",
                        });
                    }, 150);
                } else {
                    setTimeout(
                        () => router.replace("/passenger/bookings"),
                        400,
                    );
                }
            }
        } catch (err: any) {
            console.error(err);
            setMessage("Error: " + (err?.message || String(err)));
        } finally {
            setSaving(false);
        }
    }

    const showCheckIn = view !== "items";
    const showItems = view !== "checkin";

    const containerClass =
        view === "items"
            ? "bg-background text-foreground p-2 rounded shadow space-y-2 min-h-0 -mx-4 sm:mx-0 relative max-h-[85vh] overflow-visible"
            : "bg-background text-foreground p-2 rounded shadow space-y-2 min-h-[70vh] -mx-4 sm:mx-0";
    const listClass =
        view === "items"
            ? "grid grid-cols-1 gap-2 max-h-[78vh] overflow-y-auto pr-1 pb-28 -mx-4 sm:mx-0 px-0"
            : "grid grid-cols-1 gap-2 max-h-[90vh] overflow-y-auto pr-1 pb-12 md:max-h-none md:overflow-visible md:pb-0 -mx-4 sm:mx-0 px-0";

    // when an item is focused on small screens, reduce the overall container/list height
    const effectiveContainerClass = attachmentsExpanded
        ? containerClass
              .replace("min-h-[70vh]", "min-h-0")
              .replace("max-h-[85vh]", "max-h-[95vh]") +
          " overflow-auto transition-all"
        : `${containerClass} transition-all`;
    const effectiveListClass = `${listClass} ${attachmentsExpanded ? "max-h-[95vh] md:max-h-none" : ""} transition-all`;
    const actionBarClass =
        view === "items"
            ? "md:static md:border-0 md:bg-transparent md:backdrop-blur-0 absolute bottom-0 left-0 right-0 mx-0 px-2 py-3 bg-background/95 backdrop-blur border-t overflow-hidden flex items-center gap-2 flex-nowrap max-w-full"
            : "md:static md:border-0 md:bg-transparent md:backdrop-blur-0 fixed bottom-4 left-4 right-4 mx-0 px-2 py-3 bg-background/95 backdrop-blur border-t overflow-hidden flex items-center gap-2 flex-nowrap max-w-full md:relative md:bottom-auto md:left-auto md:right-auto";
    const messageClassBase =
        view === "items"
            ? "absolute left-0 right-0 bottom-14 z-50 mx-2 px-3 py-2 rounded"
            : "text-sm px-3 py-2 rounded";
    const messageClass = `${messageClassBase} ${messageType === "success" ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : "text-red-700 bg-red-50 border border-red-200"}`;

    return (
        <div className={effectiveContainerClass}>
            <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogTitle className="sr-only">Image viewer</DialogTitle>
                    <div className="flex flex-col items-center gap-4">
                        {viewerAttachments && viewerAttachments.length ? (
                            <img
                                src={viewerAttachments[viewerIndex]}
                                alt={`attachment-${viewerIndex + 1}`}
                                className="max-h-[70vh] w-full object-contain"
                            />
                        ) : null}
                        {viewerMinimal ? (
                            <div className="mt-3">
                                <button
                                    className="px-3 py-2 rounded bg-white text-sm"
                                    onClick={() => setViewerOpen(false)}
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button
                                    className="px-3 py-1 rounded border bg-background text-sm"
                                    onClick={viewerPrev}
                                    disabled={viewerIndex === 0}
                                >
                                    Prev
                                </button>
                                <a
                                    className="px-3 py-1 rounded border bg-background text-sm underline"
                                    href={viewerAttachments[viewerIndex] || "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Open
                                </a>
                                <button
                                    className="px-3 py-1 rounded border bg-background text-sm"
                                    onClick={() => openFullPage()}
                                >
                                    Full page
                                </button>
                                <a
                                    className="px-3 py-1 rounded border bg-background text-sm underline"
                                    href={viewerAttachments[viewerIndex] || "#"}
                                    download
                                >
                                    Download
                                </a>
                                <button
                                    className="px-3 py-1 rounded border bg-background text-sm"
                                    onClick={viewerNext}
                                    disabled={
                                        viewerIndex >=
                                        (viewerAttachments || []).length - 1
                                    }
                                >
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
                    <img
                        src={fullPageUrl}
                        alt="full-size"
                        className="max-h-[100vh] max-w-[100vw] object-contain"
                    />
                </div>
            ) : null}
            {showCheckIn && !DISABLE_LOCATION_TRACKER ? (
                <div
                    className={`flex items-center justify-between ${attachmentsExpanded ? "sticky top-0 z-40 bg-background/95 backdrop-blur border-b px-4 py-2" : ""}`}
                >
                    {view === "all" ? (
                        <h3 className="font-semibold">Passenger Checklist</h3>
                    ) : (
                        <div />
                    )}
                    {showCheckIn ? (
                        <div className="text-sm text-gray-600 flex items-center gap-3">
                            <span>
                                Check-in:{" "}
                                {lat ? `${lat}, ${lon}` : "Not captured"}
                            </span>
                            {lat && lon ? (
                                <a
                                    href={`https://www.google.com/maps?q=${lat},${lon}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 underline"
                                >
                                    Open map
                                </a>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            ) : null}

            {showCheckIn && !DISABLE_LOCATION_TRACKER ? (
                <div className="border rounded bg-card shadow-sm p-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <button
                            className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                            onClick={handleCheckIn}
                            disabled={checkingIn || locationVerified}
                        >
                            {checkingIn ? (
                                "Capturing..."
                            ) : (
                                <>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className="mr-1"
                                    >
                                        <path d="M12 21c-.3 0-.5-.1-.7-.3C8.1 17.1 6 14.2 6 11.5 6 7.9 8.9 5 12 5s6 2.9 6 6.5c0 2.7-2.1 5.6-5.3 9.2-.2.2-.4.3-.7.3zm0-14c-2.5 0-4.5 2-4.5 4.5 0 2.2 1.8 4.7 4.5 8.1 2.7-3.4 4.5-5.9 4.5-8.1C16.5 9 14.5 7 12 7zm0 6.5c-.8 0-1.5-.7-1.5-1.5S11.2 10.5 12 10.5s1.5.7 1.5 1.5S12.8 13.5 12 13.5z" />
                                    </svg>
                                    <span>
                                        {locationVerified
                                            ? "Checked In"
                                            : "Check In (Capture Location)"}
                                    </span>
                                </>
                            )}
                        </button>
                        <div className="md:col-span-2 text-sm text-foreground">
                            Please enable location and check in when you arrive.
                            {checkInMessage ? (
                                <div
                                    className={`mt-2 text-sm ${
                                        checkInMessageType === "success"
                                            ? "text-emerald-700"
                                            : "text-red-600"
                                    }`}
                                >
                                    {checkInMessage}
                                </div>
                            ) : !locationVerified ? (
                                <div className="mt-2 text-sm text-red-600">
                                    You must be within 100m of the site to start
                                    the checklist.
                                </div>
                            ) : null}
                            {distanceMeters != null && !locationVerified ? (
                                <div className="mt-2 text-sm text-amber-600">
                                    Distance from site:{" "}
                                    {Math.round(distanceMeters)}m
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}

            {!showItems ? null : !locationVerified ? (
                <>
                    {/* Mobile: show warning only */}
                    <div className="block md:hidden text-sm text-red-600">
                        Please check in at the site to open the checklist.
                    </div>
                    {/* Desktop: show button and warning */}
                    <div className="hidden md:block">
                        <div className="border rounded bg-card shadow-sm p-3 mb-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <button
                                    className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                    onClick={handleCheckIn}
                                    disabled={checkingIn || locationVerified}
                                >
                                    {checkingIn ? (
                                        "Capturing..."
                                    ) : (
                                        <>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="18"
                                                height="18"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                className="mr-1"
                                            >
                                                <path d="M12 21c-.3 0-.5-.1-.7-.3C8.1 17.1 6 14.2 6 11.5 6 7.9 8.9 5 12 5s6 2.9 6 6.5c0 2.7-2.1 5.6-5.3 9.2-.2.2-.4.3-.7.3zm0-14c-2.5 0-4.5 2-4.5 4.5 0 2.2 1.8 4.7 4.5 8.1 2.7-3.4 4.5-5.9 4.5-8.1C16.5 9 14.5 7 12 7zm0 6.5c-.8 0-1.5-.7-1.5-1.5S11.2 10.5 12 10.5s1.5.7 1.5 1.5S12.8 13.5 12 13.5z" />
                                            </svg>
                                            <span>
                                                Check In (Capture Location)
                                            </span>
                                        </>
                                    )}
                                </button>
                                <div className="md:col-span-2 text-sm text-red-600 flex items-center">
                                    Please check in at the site to open the
                                    checklist.
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="space-y-3" ref={checklistTopRef}>
                    <div
                        className={`sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b md:static md:border-0 md:bg-transparent md:px-0 ${attachmentsExpanded ? "md:sticky md:top-0 md:bg-background/95 md:backdrop-blur md:border-b" : ""}`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">
                                {currentCategory}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Step {currentStep + 1} of {categories.length}
                            </div>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-2 bg-primary"
                                style={{
                                    width: `${Math.round(
                                        ((currentStep + 1) /
                                            Math.max(1, categories.length)) *
                                            100,
                                    )}%`,
                                }}
                            />
                        </div>
                        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
                            {categories.map((cat, idx) => {
                                const active = idx === currentStep;
                                return (
                                    <button
                                        key={cat}
                                        className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap ${
                                            active
                                                ? "text-primary-foreground border-transparent bg-primary"
                                                : "bg-background"
                                        }`}
                                        onClick={() => setCurrentStep(idx)}
                                    >
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Mobile quick-save: show Save & continue under the tabs when not on last category */}
                        {isMobileView && currentStep < categories.length - 1 ? (
                            <div className="mt-3 md:hidden flex justify-end">
                                <button
                                    className="px-3 py-2 rounded text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={() => handleSubmit(false, true)}
                                >
                                    Save & continue
                                </button>
                            </div>
                        ) : null}
                    </div>
                    <div ref={stepScrollRef} className={effectiveListClass}>
                        {itemsForCategory.map(({ it, idx }, localIndex) => {
                            // on mobile, if a single item is focused (image uploaded) hide other items

                            return (
                                <div
                                    key={idx}
                                    data-item-idx={idx}
                                    ref={
                                        localIndex === firstIncompleteLocalIndex
                                            ? firstIncompleteRef
                                            : null
                                    }
                                    className="border p-3 rounded bg-card shadow-sm"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-medium">
                                                {it.label}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                Category: {it.category}{" "}
                                                {it.requiredPhoto ? (
                                                    <span className="text-red-600">
                                                        (photo required)
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-2 grid grid-cols-1 md:flex md:items-start md:gap-4">
                                        <div className="md:flex-1 md:min-w-0">
                                            <label className="block text-sm">
                                                Action
                                            </label>
                                            <select
                                                value={it.action || ""}
                                                onChange={(e) =>
                                                    updateItem(idx, {
                                                        action: e.target.value,
                                                    })
                                                }
                                                className="mt-1 p-2 border rounded w-full text-sm"
                                            >
                                                <option value="">
                                                    -- select action --
                                                </option>
                                                <option value="pass">
                                                    Pass
                                                </option>
                                                <option value="partial">
                                                    Partially
                                                </option>
                                                <option value="fail">
                                                    Fail
                                                </option>
                                                <option value="replaced">
                                                    Replaced
                                                </option>
                                                <option value="cleaned">
                                                    Cleaned
                                                </option>
                                            </select>
                                        </div>
                                        <div className="md:flex-1 md:min-w-0">
                                            <label className="block text-sm">
                                                Remark
                                            </label>
                                            <input
                                                value={it.remark || ""}
                                                onChange={(e) =>
                                                    updateItem(idx, {
                                                        remark: e.target.value,
                                                    })
                                                }
                                                placeholder="Add remark"
                                                className="mt-1 p-2 border rounded w-full text-sm"
                                            />
                                        </div>
                                        <div className="mt-2 md:mt-0 md:w-48">
                                            <label className="block text-sm">
                                                Attachments
                                            </label>
                                            <div className="mt-1">
                                                <label
                                                    className="relative inline-flex items-center gap-2 px-3 py-2 rounded border bg-background text-sm font-medium shadow-sm hover:bg-muted cursor-pointer"
                                                    onMouseDown={() =>
                                                        setAttachmentsExpanded(
                                                            true,
                                                        )
                                                    }
                                                    onTouchStart={() =>
                                                        setAttachmentsExpanded(
                                                            true,
                                                        )
                                                    }
                                                    onPointerDown={() =>
                                                        setAttachmentsExpanded(
                                                            true,
                                                        )
                                                    }
                                                    onClick={() => {
                                                        setAttachmentsExpanded(
                                                            true,
                                                        );
                                                        // ensure clicked item is visible on small screens
                                                        setTimeout(() => {
                                                            const container =
                                                                stepScrollRef.current;
                                                            const itemEl =
                                                                container?.querySelector(
                                                                    `[data-item-idx="${idx}"]`,
                                                                ) as HTMLElement | null;
                                                            if (itemEl)
                                                                itemEl.scrollIntoView(
                                                                    {
                                                                        behavior:
                                                                            "smooth",
                                                                        block: "center",
                                                                    },
                                                                );
                                                        }, 30);
                                                        // fallback: programmatically open the input if native click doesn't trigger file picker on some devices
                                                        /* fallback click removed — native label/input handles opening the file picker reliably; clearing input after upload below ensures repeat selections work */
                                                    }}
                                                >
                                                    <input
                                                        id={`attach-files-${idx}`}
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        onFocus={() =>
                                                            setAttachmentsExpanded(
                                                                true,
                                                            )
                                                        }
                                                        onClick={() =>
                                                            setAttachmentsExpanded(
                                                                true,
                                                            )
                                                        }
                                                        onChange={async (e) => {
                                                            const f =
                                                                e.target.files;
                                                            if (f && f.length)
                                                                await uploadChecklistFiles(
                                                                    f,
                                                                    idx,
                                                                );
                                                        }}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    />
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        width="16"
                                                        height="16"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        aria-hidden="true"
                                                    >
                                                        <path d="M21.44 11.05L12.25 20.24a5 5 0 1 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.9 9.9a2 2 0 0 1-2.83-2.83l9.19-9.19" />
                                                    </svg>
                                                    <span>Choose files</span>
                                                </label>
                                            </div>
                                            <div className="mt-2 text-sm space-y-2">
                                                {(it.attachments || []).map(
                                                    (a, i) => (
                                                        <div
                                                            key={i}
                                                            className="flex items-center gap-2"
                                                        >
                                                            {a.url ? (
                                                                <img
                                                                    src={a.url}
                                                                    alt={
                                                                        a.fileName
                                                                    }
                                                                    className="w-20 h-20 object-cover rounded cursor-pointer"
                                                                    onClick={() => {
                                                                        const urls =
                                                                            (
                                                                                it.attachments ||
                                                                                []
                                                                            )
                                                                                .map(
                                                                                    (
                                                                                        x: any,
                                                                                    ) =>
                                                                                        typeof x ===
                                                                                        "string"
                                                                                            ? x
                                                                                            : x?.url,
                                                                                )
                                                                                .filter(
                                                                                    Boolean,
                                                                                );
                                                                        const attIdx =
                                                                            (
                                                                                it.attachments ||
                                                                                []
                                                                            ).findIndex(
                                                                                (
                                                                                    x: any,
                                                                                ) =>
                                                                                    (typeof x ===
                                                                                    "string"
                                                                                        ? x
                                                                                        : x?.url) ===
                                                                                    a.url,
                                                                            );
                                                                        openImageViewer(
                                                                            urls,
                                                                            attIdx >=
                                                                                0
                                                                                ? attIdx
                                                                                : i,
                                                                            idx,
                                                                            true,
                                                                        );
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="w-20 h-20 bg-gray-100 flex items-center justify-center text-xs text-gray-500 rounded">
                                                                    Preview
                                                                </div>
                                                            )}
                                                            <div className="flex-1">
                                                                <div className="text-sm font-medium">
                                                                    {a.fileName}
                                                                </div>
                                                                {a.uploading ? (
                                                                    <div className="w-full bg-gray-200 rounded h-2 mt-1">
                                                                        <div
                                                                            className="bg-blue-600 h-2 rounded"
                                                                            style={{
                                                                                width: `${
                                                                                    a.progress ||
                                                                                    0
                                                                                }%`,
                                                                            }}
                                                                        />
                                                                    </div>
                                                                ) : a.error ? (
                                                                    <div className="text-sm text-red-600">
                                                                        Error:{" "}
                                                                        {
                                                                            a.error
                                                                        }{" "}
                                                                        <button
                                                                            className="underline ml-2"
                                                                            onClick={() => {
                                                                                // retry: re-upload by creating a File placeholder is not possible here; instruct user to re-select file
                                                                                setMessage(
                                                                                    "Retry by selecting the file again",
                                                                                );
                                                                            }}
                                                                        >
                                                                            Retry
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-sm text-gray-600">
                                                                        Uploaded
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* View button (primary) */}
                                                            {!(
                                                                viewerOpen &&
                                                                viewerItemIdx ===
                                                                    idx
                                                            ) ? (
                                                                <div>
                                                                    <button
                                                                        className="px-2 py-1 mr-2 rounded border text-sm bg-blue-50 text-blue-700"
                                                                        onClick={() =>
                                                                            openImageViewer(
                                                                                (
                                                                                    it.attachments ||
                                                                                    []
                                                                                ).map(
                                                                                    (
                                                                                        x: any,
                                                                                    ) =>
                                                                                        typeof x ===
                                                                                        "string"
                                                                                            ? x
                                                                                            : x?.url,
                                                                                ),
                                                                                i,
                                                                                idx,
                                                                                true,
                                                                            )
                                                                        }
                                                                    >
                                                                        View
                                                                    </button>
                                                                </div>
                                                            ) : null}

                                                            {!(
                                                                viewerOpen &&
                                                                viewerItemIdx ===
                                                                    idx
                                                            ) &&
                                                            !fullPageOpen ? (
                                                                <div>
                                                                    <button
                                                                        className="text-sm text-red-600"
                                                                        onClick={() => {
                                                                            // remove attachment
                                                                            const atts =
                                                                                (
                                                                                    it.attachments ||
                                                                                    []
                                                                                ).slice();
                                                                            atts.splice(
                                                                                i,
                                                                                1,
                                                                            );
                                                                            setItemAttachments(
                                                                                idx,
                                                                                atts,
                                                                            );
                                                                        }}
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                            {isMobileView &&
                                            currentStep ===
                                                categories.length - 1 &&
                                            localIndex ===
                                                itemsForCategory.length - 1 &&
                                            !attachmentsExpanded ? (
                                                <div className="mt-4 md:hidden">
                                                    <button
                                                        className="w-full px-3 py-2 rounded text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                                                        onClick={() =>
                                                            handleSubmit(true)
                                                        }
                                                        disabled={saving}
                                                    >
                                                        {saving
                                                            ? "Saving..."
                                                            : "Complete"}
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div className="h-28 md:h-12" aria-hidden="true" />
                    </div>
                </div>
            )}

            {message && <div className={messageClass}>{message}</div>}

            {locationVerified && showItems && !attachmentsExpanded ? (
                <div className={actionBarClass}>
                    {!isMobileView && (
                        <button
                            className="px-3 py-2 rounded text-sm whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() => handleSubmit(false, true)}
                            disabled={saving}
                        >
                            {saving ? "Saving..." : "Save & continue later"}
                        </button>
                    )}

                    {!isMobileView && currentStep === categories.length - 1 ? (
                        <button
                            className="px-3 py-2 rounded text-sm font-medium whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                            onClick={() => handleSubmit(true)}
                            disabled={saving}
                        >
                            {saving ? "Saving..." : "Complete"}
                        </button>
                    ) : null}
                </div>
            ) : null}
            {locationVerified && showItems && enableStepNav && showStepNav ? (
                <div className="md:hidden">
                    <button
                        className="fixed left-0 top-1/2 -translate-y-1/2 -translate-x-[55%] z-40 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow flex items-center justify-center disabled:opacity-50"
                        onClick={() =>
                            setCurrentStep((s) => Math.max(0, s - 1))
                        }
                        disabled={currentStep === 0}
                        aria-label="Previous"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="15 6 9 12 15 18" />
                        </svg>
                    </button>
                    {currentStep < categories.length - 1 ? (
                        <button
                            className="fixed right-0 top-1/2 -translate-y-1/2 translate-x-[55%] z-40 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow flex items-center justify-center"
                            onClick={() =>
                                setCurrentStep((s) =>
                                    Math.min(categories.length - 1, s + 1),
                                )
                            }
                            aria-label="Next"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
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

function fileToBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function getDefaultItems(scope?: string): ChecklistItem[] {
    // Base checklist; scope filtering applied below to keep passenger view focused
    const base: ChecklistItem[] = [
        {
            category: "Equipment",
            label: "Check the cleanness of the rack and sub rack",
            requiredPhoto: false,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },
        {
            category: "Equipment",
            label: "If not clean perform cleaning (photo required)",
            requiredPhoto: true,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },
        {
            category: "Equipment",
            label: "Check the cleanness of Air Filters",
            requiredPhoto: false,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },
        {
            category: "Equipment",
            label: "Check Equipment FAN working condition",
            requiredPhoto: false,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },
        {
            category: "Equipment",
            label: "NE alarms check",
            requiredPhoto: false,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },

        {
            category: "Power and Environment",
            label: "Diesel Generator general check",
            requiredPhoto: true,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },
        {
            category: "Power and Environment",
            label: "Load battery check",
            requiredPhoto: true,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },
        {
            category: "Power and Environment",
            label: "Air conditioner check",
            requiredPhoto: true,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },
        {
            category: "Power and Environment",
            label: "Check Ground cable",
            requiredPhoto: false,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },
        {
            category: "Power and Environment",
            label: "Fire precautions",
            requiredPhoto: false,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },

        {
            category: "Room",
            label: "Check cleanness of the room",
            requiredPhoto: true,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },
        {
            category: "Room",
            label: "Check lighting and sockets",
            requiredPhoto: true,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },
        {
            category: "Room",
            label: "Check water leakage",
            requiredPhoto: true,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },
        {
            category: "Room",
            label: "Windows and doors functioning",
            requiredPhoto: true,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },
        {
            category: "Room",
            label: "Room free from rodents",
            requiredPhoto: true,
            action: "",
            findings: [],
            remark: "",
            attachments: [],
        },
    ];

    const scopeKey = (scope || "full").toLowerCase();
    if (scopeKey === "room_only")
        return base.filter((i) => i.category === "Room");
    if (scopeKey === "room_equipment")
        return base.filter(
            (i) => i.category === "Room" || i.category === "Equipment",
        );
    if (scopeKey === "power" || scopeKey === "environment")
        return base.filter((i) => i.category === "Power and Environment");
    return base;
}

function haversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
