"use client";
import React, { useEffect, useState } from "react";

interface SiteOption {
    id: string;
    name: string;
}

export default function SiteSelect({
    value,
    onChange,
}: {
    value: string | undefined;
    onChange: (id: string) => void;
}) {
    const [options, setOptions] = useState<SiteOption[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/manager/stations")
            .then((res) => res.json())
            .then(setOptions)
            .finally(() => setLoading(false));
    }, []);

    return (
        <select
            className="border p-1 text-xs min-w-[180px]"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={loading}
        >
            <option value="">Select Site/NE</option>
            {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                    {opt.name}
                </option>
            ))}
        </select>
    );
}
