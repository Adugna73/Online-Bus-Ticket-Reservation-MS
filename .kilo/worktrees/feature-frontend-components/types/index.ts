// /types/index.ts

export interface Area {
    id: string;
    name: string;
    zoneId: string;
}

export interface Zone {
    id: string;
    name: string;
    regionId: string;
}

export interface Region {
    id: string;
    name: string;
    description: string | null;
    organizationId: string;
    zones: Zone[];
    areas: Area[];
}

export interface Organization {
    id: string;
    name: string;
    shortCode: string | null;
    createdAt: Date;
    updatedAt: Date;
    regions: Region[];
}
