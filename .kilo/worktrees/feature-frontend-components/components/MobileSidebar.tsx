"use client";
import React from "react";
import { X } from "lucide-react";
import Sidebar from "./SidebarV2";

export default function MobileSidebar({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/85" onClick={onClose} />
            {/* Drawer panel with the same sidebar content as desktop */}
            <div className="relative z-10 h-full w-full md:w-64 bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 shadow-lg overflow-y-auto">
                <div className="p-3 border-b border-border flex items-center justify-between">
                    <div className="font-semibold text-sm">
                        Online Bus Ticket Reservation
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-label="Close menu"
                    >
                        <X className="h-4 w-4 text-gray-900 dark:text-white" />
                    </button>
                </div>
                {/* Use the shared SidebarV2 in mobile mode so content matches desktop sidebar */}
                <Sidebar mobile onNavigate={onClose} />
            </div>
        </div>
    );
}
