export type ParsedStationInput = {
    name: string;
    code: string;
};

export function parseStationInput(value: string): ParsedStationInput | null {
    const raw = value.trim();
    if (!raw) return null;

    const match = raw.match(/^(.*)\(([^)]+)\)\s*$/);
    if (match) {
        return {
            name: match[1].trim(),
            code: match[2].trim().toUpperCase(),
        };
    }

    const normalizedName = raw.replace(/\s+/g, " ").trim();
    const code = normalizedName
        .replace(/[^a-zA-Z0-9]+/g, "")
        .toUpperCase();

    return {
        name: normalizedName,
        code: code || normalizedName.toUpperCase().replace(/\s+/g, ""),
    };
}
