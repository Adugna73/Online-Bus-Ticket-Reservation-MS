  import { NextApiRequest, NextApiResponse } from 'next';
  import { prisma } from '../../../lib/prisma';

  export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Fetch all supervisors with their region and all sites in their region
    if (req.method === 'GET' && req.query.allSupervisorsSitesByRegion === 'true') {
      try {
        // Get user from session (assume req.user or req.headers for now)
        const user = (req as any).user || (req as any).session?.user || null;
        let isAdmin = false;
        let managerRegions: string[] = [];
        let managerZones: string[] = [];
        if (user) {
          isAdmin = (user.role === 'admin' || user.role?.key === 'admin');
          if (user.assignedRegion) managerRegions = Array.isArray(user.assignedRegion) ? user.assignedRegion : [user.assignedRegion];
          if (user.assignedZone) managerZones = Array.isArray(user.assignedZone) ? user.assignedZone : [user.assignedZone];
        }
        let supervisorWhere: any = { role: { key: 'supervisor' } };
        if (!isAdmin && managerRegions.length + managerZones.length > 0) {
          supervisorWhere = {
            ...supervisorWhere,
            OR: [
              ...(managerRegions.length > 0 ? [{ locationCategory: { in: managerRegions } }] : []),
              ...(managerZones.length > 0 ? [{ location: { in: managerZones } }] : []),
            ],
          };
        }
        const supervisors = await prisma.user.findMany({
          where: supervisorWhere,
          select: { id: true, fullName: true, locationCategory: true },
          orderBy: { fullName: 'asc' },
        });
        // For each supervisor, fetch all sites in their region
        const result = [];
        for (const sup of supervisors) {
          let sites: any[] = [];
          if (sup.locationCategory) {
            sites = await prisma.site.findMany({
              where: { region: { name: { equals: sup.locationCategory, mode: 'insensitive' } } },
              select: {
                id: true,
                name: true,
                siteCode: true,
                region: { select: { id: true, name: true } },
                zone: { select: { id: true, name: true } },
                area: { select: { id: true, name: true } },
              },
              orderBy: { name: 'asc' },
            });
          }
          result.push({ supervisor: { id: sup.id, fullName: sup.fullName, region: sup.locationCategory }, sites });
        }
        return res.status(200).json({ supervisors: result });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch supervisors and sites by region' });
      }
    }
  // Fetch all supervisors for dropdowns or selection
  if (req.method === 'GET' && req.query.allSupervisors === 'true') {
    try {
      // Get user from session (assume req.user or req.headers for now)
      const user = (req as any).user || (req as any).session?.user || null;
      let isAdmin = false;
      let managerRegions: string[] = [];
      let managerZones: string[] = [];
      if (user) {
        isAdmin = (user.role === 'admin' || user.role?.key === 'admin');
        if (user.assignedRegion) managerRegions = Array.isArray(user.assignedRegion) ? user.assignedRegion : [user.assignedRegion];
        if (user.assignedZone) managerZones = Array.isArray(user.assignedZone) ? user.assignedZone : [user.assignedZone];
      }
      let supervisorWhere: any = { role: { key: 'supervisor' } };
      if (!isAdmin && managerRegions.length + managerZones.length > 0) {
        supervisorWhere = {
          ...supervisorWhere,
          OR: [
            ...(managerRegions.length > 0 ? [{ locationCategory: { in: managerRegions } }] : []),
            ...(managerZones.length > 0 ? [{ location: { in: managerZones } }] : []),
          ],
        };
      }
      const supervisors = await prisma.user.findMany({
        where: supervisorWhere,
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      });
      return res.status(200).json({ supervisors });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch supervisors' });
    }
  }

  // Fetch all sites for dropdowns or selection, with optional region/zone filter
  if (req.method === 'GET' && req.query.allSites === 'true') {
    try {
      const regionName = req.query.region as string | undefined;
      const zoneName = req.query.zone as string | undefined;
      const where: any = {};
      if (regionName) {
        where.region = { name: { equals: regionName, mode: 'insensitive' } };
      }
      if (zoneName) {
        where.zone = { name: { equals: zoneName, mode: 'insensitive' } };
      }
      const sites = await prisma.site.findMany({
        where,
        select: {
          id: true,
          name: true,
          siteCode: true,
          region: { select: { id: true, name: true } },
          zone: { select: { id: true, name: true } },
          area: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      });
      return res.status(200).json({ sites });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch sites' });
    }
  }
  // Only require supervisorId in query for GET
  let supervisorId: string | undefined = undefined;
  if (req.method === 'GET') {
    supervisorId = req.query.supervisorId as string;
    if (!supervisorId || typeof supervisorId !== 'string') {
      return res.status(400).json({ error: 'Missing supervisorId' });
    }
    supervisorId = decodeURIComponent(supervisorId);
  }

  if (req.method === 'GET') {
    try {
      // Allow supervisor lookup by id or name
      let supervisor = await prisma.user.findUnique({
        where: { id: supervisorId },
        select: {
          id: true,
          fullName: true,
          supervisorStation: {
            select: { id: true, name: true, area: { select: { id: true, name: true } }, region: { select: { id: true, name: true } } },
          },
          location: true,
          locationCategory: true,
        },
      });
      if (!supervisor) {
        supervisor = await prisma.user.findFirst({
          where: { fullName: supervisorId },
          select: {
            id: true,
            fullName: true,
            supervisorStation: {
              select: { id: true, name: true, area: { select: { id: true, name: true } }, region: { select: { id: true, name: true } } },
            },
            location: true,
            locationCategory: true,
          },
        });
        if (!supervisor) return res.status(404).json({ error: 'Supervisor not found by id or name' });
      }

      // Fetch technicians directly reporting to this supervisor
      const technicians = await prisma.user.findMany({
        where: {
          immediateSupervisorId: supervisor.id,
          role: { key: 'technician' },
        },
        select: { id: true, fullName: true, email: true },
      });

      // Fetch sites/NEs managed by this supervisor (by area/region or explicit assignment)
      let sites: { id: string; name: string }[] = [];
      if (supervisor?.supervisorStation) {
        // Get all sites in the same area as the supervisor's station
        if (supervisor.supervisorStation.area) {
          sites = await prisma.site.findMany({
            where: { areaId: supervisor.supervisorStation.area.id },
            select: { id: true, name: true },
          });
        } else if (supervisor.supervisorStation.region) {
          sites = await prisma.site.findMany({
            where: { regionId: supervisor.supervisorStation.region.id },
            select: { id: true, name: true },
          });
        } else {
          // Fallback: just the supervisor's station
          sites = [
            { id: supervisor.supervisorStation.id, name: supervisor.supervisorStation.name },
          ];
        }
      } else if (supervisor?.location) {
        // Fallback: find area by name
        const area = await prisma.area.findFirst({ where: { name: supervisor.location } });
        if (area) {
          sites = await prisma.site.findMany({ where: { areaId: area.id }, select: { id: true, name: true } });
        }
      }

      return res.status(200).json({ technicians, sites });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch supervisor details' });
    }
  }

  // Add technician or site/NE to supervisor
  if (req.method === 'POST') {
    let { type, supervisorId: supId, data, userRole, userRegion } = req.body;
    // Debug log incoming POST body
    console.log('POST /api/manager/supervisor-details body:', req.body);
    if (!type || !supId || !data || !userRole) {
      console.error('400 error: missing field', { type, supId, data, userRole });
      return res.status(400).json({ error: 'Missing type, supervisorId, data, or userRole' });
    }
    // Always decode supId for lookup (handles URL encoding and spaces)
    supId = decodeURIComponent(supId);
    try {
      // Allow supervisor lookup by id or name (case-insensitive, trimmed)
      let supervisor = await prisma.user.findUnique({ where: { id: supId }, select: { id: true, locationCategory: true, location: true, fullName: true } });
      if (!supervisor) {
        supervisor = await prisma.user.findFirst({
          where: {
            fullName: {
              equals: supId.trim(),
              mode: 'insensitive',
            },
          },
          select: { id: true, locationCategory: true, location: true, fullName: true },
        });
        if (!supervisor) {
          // Log all supervisor fullNames for debugging
          const allSupervisors = await prisma.user.findMany({ where: { role: { key: 'supervisor' } }, select: { id: true, fullName: true } });
          console.error('404 error: supervisor not found', { supId, allSupervisorNames: allSupervisors.map(s => s.fullName) });
          return res.status(404).json({ error: 'Supervisor not found by id or name', allSupervisorNames: allSupervisors.map(s => s.fullName) });
        }
      }
      const supervisorRegion = supervisor?.locationCategory || null;
      // Only admin or manager of the same region can add
      if (
        userRole !== 'admin' &&
        !(userRole === 'manager' && userRegion && supervisorRegion && userRegion === supervisorRegion)
      ) {
        return res.status(403).json({ error: 'Forbidden: Only admin or manager of this region can add' });
      }
      if (type === 'technician') {
        // Create a new technician and assign to supervisor
        const tech = await prisma.user.create({
          data: {
            fullName: data.fullName,
            email: data.email,
            username: data.username || data.email || data.fullName.replace(/\s+/g, '').toLowerCase(),
            role: { connect: { key: 'technician' } },
            immediateSupervisor: { connect: { id: supervisor.id } },
          },
        });
        return res.status(201).json({ technician: { id: tech.id, fullName: tech.fullName, email: tech.email } });
      } else if (type === 'site') {
        // Create a new site/NE and assign to supervisor's area/region if possible
        let regionId = undefined;
        let areaId = undefined;
        if (supervisor?.locationCategory) {
          const region = await prisma.region.findFirst({ where: { name: supervisor.locationCategory } });
          if (region) regionId = region.id;
        }
        if (supervisor?.location) {
          const area = await prisma.area.findFirst({ where: { name: supervisor.location } });
          if (area) areaId = area.id;
        }
        const siteData: any = {
          name: data.name,
          siteCode: data.siteCode || `${data.name.replace(/\s+/g, '_').toUpperCase()}_${Date.now()}`,
        };
        if (typeof regionId === 'string') siteData.regionId = regionId;
        if (typeof areaId === 'string') siteData.areaId = areaId;
        const site = await prisma.site.create({ data: siteData });
        return res.status(201).json({ site: { id: site.id, name: site.name } });
      }
      return res.status(400).json({ error: 'Invalid type' });
    } catch (err) {
      console.error('POST /api/manager/supervisor-details error:', err);
      return res.status(500).json({ error: 'Failed to add technician or site', details: (err && typeof err === 'object' && 'message' in err) ? (err as any).message : String(err) });
    }
  }

  // Update technician or site/NE
  if (req.method === 'PUT') {
    let { type, id, data, userRole, userRegion, supervisorId: supId } = req.body;
    if (!type || !id || !data || !userRole || !supId) return res.status(400).json({ error: 'Missing type, id, data, userRole, or supervisorId' });
    // Always decode supId for lookup (handles URL encoding and spaces)
    supId = decodeURIComponent(supId);
    try {
      // Allow supervisor lookup by id or name (case-insensitive, trimmed)
      let supervisor = await prisma.user.findUnique({ where: { id: supId }, select: { id: true, locationCategory: true, location: true, fullName: true } });
      if (!supervisor) {
        supervisor = await prisma.user.findFirst({
          where: {
            fullName: {
              equals: supId.trim(),
              mode: 'insensitive',
            },
          },
          select: { id: true, locationCategory: true, location: true, fullName: true },
        });
        if (!supervisor) {
          const allSupervisors = await prisma.user.findMany({ where: { role: { key: 'supervisor' } }, select: { id: true, fullName: true } });
          console.error('404 error: supervisor not found (PUT)', { supId, allSupervisorNames: allSupervisors.map(s => s.fullName) });
          return res.status(404).json({ error: 'Supervisor not found by id or name', allSupervisorNames: allSupervisors.map(s => s.fullName) });
        }
      }
      const supervisorRegion = supervisor?.locationCategory || null;
      // Only admin or manager of the same region can update
      if (
        userRole !== 'admin' &&
        !(userRole === 'manager' && userRegion && supervisorRegion && userRegion === supervisorRegion)
      ) {
        return res.status(403).json({ error: 'Forbidden: Only admin or manager of this region can update' });
      }
      if (type === 'technician') {
        const tech = await prisma.user.update({
          where: { id },
          data: {
            fullName: data.fullName,
            email: data.email,
          },
        });
        return res.status(200).json({ technician: { id: tech.id, fullName: tech.fullName, email: tech.email } });
      } else if (type === 'site') {
        const site = await prisma.site.update({
          where: { id },
          data: {
            name: data.name,
            siteCode: data.siteCode,
          },
        });
        return res.status(200).json({ site: { id: site.id, name: site.name } });
      }
      return res.status(400).json({ error: 'Invalid type' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update technician or site' });
    }
  }

  // Delete technician or site/NE
  if (req.method === 'DELETE') {
    let { type, id, userRole, userRegion, supervisorId: supId } = req.body;
    if (!type || !id || !userRole || !supId) return res.status(400).json({ error: 'Missing type, id, userRole, or supervisorId' });
    // Always decode supId for lookup (handles URL encoding and spaces)
    supId = decodeURIComponent(supId);
    try {
      // Allow supervisor lookup by id or name (case-insensitive, trimmed)
      let supervisor = await prisma.user.findUnique({ where: { id: supId }, select: { id: true, locationCategory: true, location: true, fullName: true } });
      if (!supervisor) {
        supervisor = await prisma.user.findFirst({
          where: {
            fullName: {
              equals: supId.trim(),
              mode: 'insensitive',
            },
          },
          select: { id: true, locationCategory: true, location: true, fullName: true },
        });
        if (!supervisor) {
          const allSupervisors = await prisma.user.findMany({ where: { role: { key: 'supervisor' } }, select: { id: true, fullName: true } });
          console.error('404 error: supervisor not found (DELETE)', { supId, allSupervisorNames: allSupervisors.map(s => s.fullName) });
          return res.status(404).json({ error: 'Supervisor not found by id or name', allSupervisorNames: allSupervisors.map(s => s.fullName) });
        }
      }
      const supervisorRegion = supervisor?.locationCategory || null;
      // Only admin or manager of the same region can delete
      if (
        userRole !== 'admin' &&
        !(userRole === 'manager' && userRegion && supervisorRegion && userRegion === supervisorRegion)
      ) {
        return res.status(403).json({ error: 'Forbidden: Only admin or manager of this region can delete' });
      }
      if (type === 'technician') {
        await prisma.user.delete({ where: { id } });
        return res.status(204).end();
      } else if (type === 'site') {
        await prisma.site.delete({ where: { id } });
        return res.status(204).end();
      }
      return res.status(400).json({ error: 'Invalid type' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete technician or site' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
