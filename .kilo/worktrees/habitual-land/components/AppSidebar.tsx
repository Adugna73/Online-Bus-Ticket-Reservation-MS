export { default as AppSidebar } from "./SidebarV2";

// 	/*
// 					const user = session?.user as any;
// 					const role = String(user?.role || user?.roleKey || "").toLowerCase();
// 					const assignedZones = (user?.assignedZone || []).map((z: string) => String(z).toUpperCase());
// 					if (role === "supervisor" && assignedZones.some(z => z.includes("AAZ") || z.includes("HQ")) && muhabaSites.length > 0) {
// 						return (
// 							<SidebarCollapsibleGroup label={<span className="sidebar-label">Sites / NE (Muhaba)</span>} defaultOpen>
// 								<SidebarMenu>
// 									{muhabaSites.map(site => (
// 										<SidebarMenuItem key={site.id}>
// 											<Link href={`/stations/${site.id}`} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50">
// 												<MapPin className="h-4 w-4" />
// 												<span className="sidebar-label">{site.name} ({site.siteCode})</span>
// 											</Link>
// 										</SidebarMenuItem>
// 									))}
// 								</SidebarMenu>
// 							</SidebarCollapsibleGroup>
// 						);
// 					}
// 					return null;
// 	*/
// //                 <SidebarCollapsibleGroup
// //                     label={<span className="sidebar-label">Bookings</span>}
// //                     defaultOpen
// //                 >
// //                     <SidebarMenu>
// //                         {(() => {
// //                             const workOrdersMenu = menu.find(
// //                                 (m: any) => m.title === "Bookings",
// //                             ) as any;
// //                             return workOrdersMenu?.subfolders
// //                                 ?.filter(Boolean)
// //                                 .map((s: any) => (
// //                                     <SidebarMenuItem key={s.href}>
// //                                         <Link
// //                                             href={s.href}
// //                                             className="pointer-events-auto cursor-pointer flex justify-between items-center px-2 py-1 rounded hover:bg-muted/50"
// //                                         >
// //                                             <span className="sidebar-label">
// //                                                 {s.title}
// //                                             </span>
// //                                         </Link>
// //                                     </SidebarMenuItem>
// //                                 ));
// //                         })()}
// //                     </SidebarMenu>
// //                 </SidebarCollapsibleGroup>

// //                 <SidebarMenu>
// //                     {menu
// //                         .filter(
// //                             (m: any) =>
// //                                 m.title !== "Bookings" &&
// //                                 m.title !== "Team",
// //                         )
// //                         .map((m: any) => (
// //                             <SidebarMenuItem key={m.href}>
// //                                 <Link
// //                                     href={m.href}
// //                                     className={`flex items-center gap-3 px-2 py-2 rounded ${
// //                                         path?.startsWith(m.href)
// //                                             ? "bg-muted/30"
// //                                             : "hover:bg-muted/10"
// //                                     }`}
// //                                 >
// //                                     {m.icon}
// //                                     <span className="sidebar-label">
// //                                         {m.title}
// //                                     </span>
// //                                 </Link>
// //                             </SidebarMenuItem>
// //                         ))}
// //                 </SidebarMenu>

// //                 <SidebarCollapsibleGroup
// //                     label={<span className="sidebar-label">Team</span>}
// //                     defaultOpen
// //                 >
// //                     <div className="pl-1">
// //                         {regions.map((region) => (
// //                             <div key={region.id} className="mb-2">
// //                                 <div className="flex items-center gap-2 text-sm font-medium">
// //                                     <button
// //                                         className="p-1"
// //                                         onClick={() =>
// //                                             setExpandedRegions((p) => ({
// //                                                 ...p,
// //                                                 [region.id]: !p[region.id],
// //                                             }))
// //                                         }
// //                                     >
// //                                         {expandedRegions[region.id] ? (
// //                                             <ChevronDown className="h-4 w-4" />
// //                                         ) : (
// //                                             <ChevronRight className="h-4 w-4" />
// //                                         )}
// //                                     </button>
// //                                     <div className="sidebar-label">
// //                                         {region.name}
// //                                     </div>
// //                                 </div>
// //                                 {expandedRegions[region.id] && (
// //                                     <div className="pl-4 mt-1">
// //                                         {zones
// //                                             .filter(
// //                                                 (z) => z.regionId === region.id,
// //                                             )
// //                                             .map((zone) => (
// //                                                 <div
// //                                                     key={zone.id}
// //                                                     className="mb-1"
// //                                                 >
// //                                                     <div className="flex items-center gap-2 text-sm">
// //                                                         <div className="font-medium sidebar-label">
// //                                                             {zone.name}
// //                                                         </div>
// //                                                     </div>
// //                                                     <div className="pl-4 mt-1">
// //                                                         {(
// //                                                             team.filter(
// //                                                                 (t) =>
// //                                                                     (t.assignedZone ||
// //                                                                         [])[0] ===
// //                                                                     zone.id,
// //                                                             ) || []
// //                                                         ).map((t) => (
// //                                                             <div
// //                                                                 key={t.id}
// //                                                                 className="mb-1 text-sm sidebar-label"
// //                                                             >
// //                                                                 <Link
// //                                                                     href={`/team/${t.id}`}
// //                                                                 >
// //                                                                     {t.name}
// //                                                                 </Link>
// //                                                             </div>
// //                                                         ))}
// //                                                     </div>
// //                                                 </div>
// //                                             ))}
// //                                     </div>
// //                                 )}
// //                             </div>
// //                         ))}
// //                     </div>
// //                 </SidebarCollapsibleGroup>

// //                 <div>
// //                     <div className="text-xs font-semibold mb-2">Categories</div>
// //                     <ul className="space-y-1 text-sm">
// //                         {categories.map((c) => (
// //                             <li key={c.id}>
// //                                 <Link
// //                                     href={`/maintenance?category=${c.id}`}
// //                                     className="block hover:underline"
// //                                 >
// //                                     {c.name}
// //                                 </Link>
// //                             </li>
// //                         ))}
// //                     </ul>
// //                 </div>
// //             </SidebarContent>

// //             <SidebarFooter>
// //                 <div className="text-xs text-muted-foreground space-y-1">
// //                     <div className="font-medium">
// //                         {(session?.user as any)?.name}
// //                     </div>
// //                     <div>
// //                         {(() => {
// //                             const user = session?.user as any;
// //                             const assignedRegions = user?.assignedRegion || [];
// //                             const assignedZones = user?.assignedZone || [];
// //                             const role = user?.role || "Passenger";

// //                             // Get all region and zone names
// //                             const regionNames = getRegionNames(assignedRegions);
// //                             const zoneNames = getZoneNames(assignedZones);

// //                             // For managers and supervisors: show region and zone info
// //                             if (
// //                                 (roleLower === "manager" ||
// //                                     roleLower === "supervisor") &&
// //                                 (regionNames || zoneNames)
// //                             ) {
// //                                 const parts = [];
// //                                 if (regionNames) parts.push(regionNames);
// //                                 if (zoneNames) parts.push(`${zoneNames} Area`);
// //                                 return `${parts.join(" - ")} (${role})`;
// //                             }

// //                             // For passengers: show region and zone with location context
// //                             if (
// //                                 roleLower === "passenger" &&
// //                                 (regionNames || zoneNames)
// //                             ) {
// //                                 const parts = [];
// //                                 if (regionNames) parts.push(regionNames);
// //                                 if (zoneNames)
// //                                     parts.push(`${zoneNames} Location`);
// //                                 return `${parts.join(" - ")} (${role})`;
// //                             }

// //                             // For admins or users without assignments: check location data
// //                             if (
// //                                 roleLower === "admin" ||
// //                                 (!regionNames && !zoneNames)
// //                             ) {
// //                                 // Check if user has location data from profile
// //                                 const locationCategory = user?.locationCategory;
// //                                 const location = user?.location;
// //                                 if (locationCategory || location) {
// //                                     const parts = [];
// //                                     if (locationCategory === "Head Quarter") {
// //                                         parts.push("HQ");
// //                                     } else if (locationCategory) {
// //                                         parts.push(locationCategory);
// //                                     }
// //                                     if (
// //                                         location &&
// //                                         location !== locationCategory
// //                                     ) {
// //                                         parts.push(location);
// //                                     }
// //                                     return `${parts.join(" - ")} (${role})`;
// //                                 }
// //                                 return role;
// //                             }

// //                             // Fallback: show what we have
// //                             if (regionNames && zoneNames) {
// //                                 return `${regionNames}-${zoneNames} (${role})`;
// //                             }
// //                             if (regionNames) {
// //                                 return `${regionNames} (${role})`;
// //                             }
// //                             if (zoneNames) {
// //                                 return `${zoneNames} (${role})`;
// //                             }

// //                             return role;
// //                         })()}
// //                     </div>
// //                 </div>
// //             </SidebarFooter>
// //             <SidebarRail />

