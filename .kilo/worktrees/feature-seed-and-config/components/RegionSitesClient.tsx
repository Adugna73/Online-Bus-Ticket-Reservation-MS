import React from "react";
import SitesClient from "./SitesClient";

interface RegionSitesClientProps {
    regionName: string;
}

// This component wraps SitesClient and auto-filters to the given region
export default function RegionSitesClient({
    regionName,
}: RegionSitesClientProps) {
    // Pass regionName as a prop to SitesClient and hide the region filter
    return <SitesClient fixedRegionName={regionName} hideRegionFilter />;
}
