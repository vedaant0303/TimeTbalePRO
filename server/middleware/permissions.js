const PERMISSIONS = {
  // Workload
  'workload:upload':          ['hod', 'coordinator'],
  'workload:view':            ['admin', 'hod', 'coordinator'],
  'workload:approve':         ['hod'],

  // Subject Configuration
  'subjectConfig:create':     ['coordinator', 'hod'],
  'subjectConfig:edit':       ['coordinator', 'hod'],
  'subjectConfig:view':       ['coordinator', 'admin', 'hod'],
  'subjectConfig:approve':    ['hod'],

  // Room Management
  'rooms:viewAll':            ['admin', 'hod', 'coordinator', 'faculty', 'student'],
  'rooms:setAccessibility':   ['admin', 'coordinator'],
  'rooms:setAllocation':      ['admin', 'coordinator'],
  'rooms:editLabRoom':        ['coordinator', 'admin'],

  // Timetable Generation — only coordinator & HOD, NOT admin
  'timetable:generate':       ['coordinator', 'hod'],
  'timetable:viewMaster':     ['admin', 'hod', 'principal', 'coordinator'],
  'timetable:viewOwn':        ['faculty', 'student', 'coordinator'],

  // Timetable Editing — only coordinator & HOD
  'timetable:editAll':        ['coordinator', 'hod'],
  'timetable:editLabRoom':    ['coordinator'],
  'timetable:submitApproval': ['hod'],
  'timetable:approve':        ['principal'],
  'timetable:publish':        ['admin', 'hod'],

  // Semester Config
  'semester:create':          ['admin', 'hod', 'coordinator'],
  'semester:advanceState':    ['admin', 'hod', 'coordinator'],
  'semester:view':            ['admin', 'hod', 'coordinator', 'principal'],

  // Profile Management
  'profile:editFaculty':      ['admin'],
  'profile:editStudentBatch': ['admin', 'faculty'],
  'profile:viewOwn':          ['faculty', 'student', 'coordinator'],

  // Department Management — admin only
  'department:create':        ['admin'],
  'department:edit':          ['admin'],
  'department:delete':        ['admin'],

  // Export
  'export:all':               ['admin', 'hod', 'principal'],
  'export:own':               ['faculty', 'coordinator', 'student']
};

/**
 * Check if a role has a specific permission
 */
function hasPermission(role, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

/**
 * Middleware: require a specific permission
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        message: `Access denied. Requires '${permission}' permission.`
      });
    }
    next();
  };
}

/**
 * Middleware: require any of the given permissions
 */
function requireAnyPermission(permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const hasAny = permissions.some(p => hasPermission(req.user.role, p));
    if (!hasAny) {
      return res.status(403).json({
        message: `Access denied. Requires one of: ${permissions.join(', ')}`
      });
    }
    next();
  };
}

/**
 * Middleware: validate coordinator scope (only their assigned classes)
 */
async function validateCoordinatorScope(req, res, next) {
  if (req.user.role === 'admin') return next(); // admin bypasses
  if (req.user.role !== 'coordinator') return next();

  const Class = require('../models/Class');
  const { classId } = req.params;
  if (!classId) return next();

  const isCoord = await Class.exists({ _id: classId, coordinator: req.user._id });
  if (!isCoord) {
    return res.status(403).json({ message: 'Not coordinator of this class.' });
  }
  next();
}

module.exports = { PERMISSIONS, hasPermission, requirePermission, requireAnyPermission, validateCoordinatorScope };
