const TimetableSlot = require('../models/TimetableSlot');
const SubjectAllocation = require('../models/SubjectAllocation');
const FacultyWorkload = require('../models/FacultyWorkload');
const RoomAllocation = require('../models/RoomAllocation');
const SemesterConfig = require('../models/SemesterConfig');
const TimeSlot = require('../models/TimeSlot');
const Class = require('../models/Class');
const Room = require('../models/Room');
const User = require('../models/User');
const FacultyModel = require('../models/Faculty');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/**
 * Main timetable generation function
 * Implements rotation-block scheduling for practicals:
 *   All batches get practicals at the SAME time slot,
 *   each batch doing a DIFFERENT subject (Latin-square rotation).
 */
async function generateTimetable(semesterId, userId, io) {
  const config = await SemesterConfig.findById(semesterId);
  if (!config) throw new Error('Semester config not found');
  if (config.generationState !== 'ready_to_generate') {
    throw new Error(`Cannot generate: current state is '${config.generationState}'`);
  }

  // Transition to generating
  config.transitionTo('generating', userId, 'Generation started');
  await config.save();
  if (io) io.emit('semester-state-changed', { semesterId, newState: 'generating' });

  try {
    // ═══════════════════════════════════════════
    // PHASE 1: Load all data
    // ═══════════════════════════════════════════
    if (io) io.emit('generation-progress', { semesterId, percent: 5, message: 'Loading configuration data...' });

    // ★ FRESH FETCH: Always get the latest time slots from the DB
    const timeSlots = await TimeSlot.find({ academicYear: config.academicYear, isActive: true, isBreak: false })
      .sort({ slotNumber: 1 });
    const allTimeSlots = await TimeSlot.find({ academicYear: config.academicYear, isActive: true })
      .sort({ slotNumber: 1 });

    console.log(`[Generator] ★ Fetched ${timeSlots.length} teaching time slots (${allTimeSlots.length} total) from DB`);
    console.log(`[Generator] Teaching slots: ${timeSlots.map(s => s.startTime + '-' + s.endTime).join(', ')}`);

    // ★ FRESH FETCH: Always get the latest classes from the DB
    const classes = await Class.find({
      department: { $in: config.departments },
      isActive: true
    });

    console.log(`[Generator] ★ Fetched ${classes.length} active classes from DB`);

    if (timeSlots.length === 0) throw new Error('No time slots configured');
    if (classes.length === 0) throw new Error('No classes configured');

    // Load room allocations for all departments
    const roomAllocations = {};
    for (const deptId of config.departments) {
      const alloc = await RoomAllocation.findOne({ semesterId, departmentId: deptId });
      if (alloc) {
        roomAllocations[deptId.toString()] = alloc;
      }
    }

    // ★ FRESH FETCH: Always get the latest subject configs from the DB
    const subjectConfigs = await SubjectAllocation.find({
      semesterId,
      status: 'approved'
    }).populate('theoryFacultyId');

    console.log(`[Generator] ★ Fetched ${subjectConfigs.length} approved subject configurations from DB`);
    if (subjectConfigs.length > 0) {
      console.log(`[Generator] Subject configs: ${subjectConfigs.map(sc => sc.subject?.code || 'N/A').join(', ')}`);
    }

    if (subjectConfigs.length === 0) throw new Error('No approved subject configurations');

    // Pre-compute valid consecutive slot pairs (for 2-hour practicals)
    const consecutivePairs = [];
    for (let i = 0; i < timeSlots.length - 1; i++) {
      const ts1 = timeSlots[i];
      const ts2 = timeSlots[i + 1];
      if (ts1.endTime === ts2.startTime) {
        consecutivePairs.push([ts1, ts2]);
      }
    }

    // ═══════════════════════════════════════════
    // PHASE 2: Build occupancy matrix
    // ═══════════════════════════════════════════
    if (io) io.emit('generation-progress', { semesterId, percent: 15, message: 'Building constraint matrix...' });

    const occupied = {};
    const isOccupied = (key) => !!occupied[key];
    const markOccupied = (keys) => keys.forEach(k => occupied[k] = true);

    // Load existing slots from other semesters/departments
    const otherSlots = await TimetableSlot.find({
      semesterId: { $ne: semesterId }
    });
    for (const slot of otherSlots) {
      if (slot.facultyId) {
        markOccupied([`f-${slot.facultyId}-${slot.day}-${slot.startTime}`]);
      }
      if (slot.roomId) {
        markOccupied([`r-${slot.roomId}-${slot.day}-${slot.startTime}`]);
      }
    }

    // ═══════════════════════════════════════════
    // PHASE 3: Clear existing slots for these departments
    // ═══════════════════════════════════════════
    if (io) io.emit('generation-progress', { semesterId, percent: 20, message: 'Clearing existing entries...' });

    await TimetableSlot.deleteMany({
      semesterId,
      department: { $in: config.departments }
    });

    // ═══════════════════════════════════════════
    // PHASE 4: Pre-seed fixed/locked slots
    // ═══════════════════════════════════════════
    if (io) io.emit('generation-progress', { semesterId, percent: 25, message: 'Placing fixed slots...' });

    const fixedSlots = [];
    for (const sc of subjectConfigs) {
      if (sc.fixedSlots && sc.fixedSlots.length > 0) {
        for (const fs of sc.fixedSlots) {
          const cls = classes.find(c => c._id.toString() === sc.classId.toString());
          if (!cls) continue;

          const slotData = {
            semesterId,
            department: sc.departmentId,
            classId: sc.classId,
            day: fs.day,
            startTime: fs.startTime,
            endTime: fs.endTime,
            subjectCode: sc.subject.code,
            subjectName: sc.subject.name,
            facultyId: sc.theoryFacultyId?._id || sc.theoryFacultyId,
            roomId: fs.roomId,
            slotType: sc.subject.type === 'project' ? 'miniproject' :
                      sc.subject.type === 'DLOC' ? 'DLOC' :
                      sc.subject.type === 'ILOC' ? 'ILOC' :
                      sc.subject.type === 'honours' ? 'honours' : sc.subject.type,
            isLocked: true,
            status: 'draft',
            createdBy: userId,
            lastModifiedBy: userId
          };

          const slot = new TimetableSlot(slotData);
          await slot.save();
          fixedSlots.push(slot);

          // Mark occupied
          const keys = [`c-${sc.classId}-${fs.day}-${fs.startTime}`];
          if (slotData.facultyId) keys.push(`f-${slotData.facultyId}-${fs.day}-${fs.startTime}`);
          if (fs.roomId) keys.push(`r-${fs.roomId}-${fs.day}-${fs.startTime}`);
          markOccupied(keys);
        }
      }
    }

    // ═══════════════════════════════════════════
    // PHASE 5: Build scheduling requirements
    // ═══════════════════════════════════════════
    if (io) io.emit('generation-progress', { semesterId, percent: 30, message: 'Building requirements...' });

    const theoryRequirements = [];
    const combinedRequirements = [];
    // Collect raw practical data per class for rotation grouping
    const practicalsByClass = {};  // classId -> [{ subjectCode, subjectName, batchLabel, facultyId, labId, hours }]

    for (const sc of subjectConfigs) {
      const cls = classes.find(c => c._id.toString() === sc.classId.toString());
      if (!cls) continue;

      // Skip if already fully placed via fixed slots
      if (sc.fixedSlots && sc.fixedSlots.length > 0 && sc.theoryHours === 0 && (!sc.batches || sc.batches.length === 0)) {
        continue;
      }

      // Check if this subject has combined theory groups
      // If so, skip standard theory requirements to avoid double-scheduling
      const hasCombinedTheoryGroups = sc.isCombinedBatch &&
        sc.combinedGroups && sc.combinedGroups.some(cg => (cg.type || sc.subject.type || 'theory') === 'theory');

      // --- Theory lectures (only if NO combined theory groups exist) ---
      if (!hasCombinedTheoryGroups) {
        for (let i = 0; i < (sc.theoryHours || 0); i++) {
          const fixedTheoryCount = (sc.fixedSlots || []).filter(f => !f.batch).length;
          if (i < fixedTheoryCount) continue;

          theoryRequirements.push({
            classId: sc.classId,
            departmentId: sc.departmentId,
            subjectCode: sc.subject.code,
            subjectName: sc.subject.name,
            facultyId: sc.theoryFacultyId?._id || sc.theoryFacultyId,
            type: 'theory',
            slotType: sc.subject.type === 'OE' ? 'OE' : 'theory',
            batch: null,
            needsLab: false,
            isCombined: false,
            constraintTightness: sc.isCrossDeptFaculty ? 10 : 3
          });
        }
      }

      // --- Combined batch groups (theory or practical) ---
      if (sc.isCombinedBatch && sc.combinedGroups && sc.combinedGroups.length > 0) {
        for (const cg of sc.combinedGroups) {
          const groupType = cg.type || sc.subject.type || 'theory';
          const groupFacultyId = cg.facultyId || sc.theoryFacultyId?._id || sc.theoryFacultyId;

          if (groupType === 'practical') {
            // Practical combined: needs 2 consecutive slots + lab room
            combinedRequirements.push({
              classId: sc.classId,
              departmentId: sc.departmentId,
              subjectCode: sc.subject.code,
              subjectName: sc.subject.name,
              facultyId: groupFacultyId,
              roomId: cg.labId,
              type: 'combined',
              slotType: 'combined',
              batch: null,
              combinedBatches: cg.batches,
              needsLab: true,
              isCombined: true,
              constraintTightness: 15
            });
          } else {
            // Theory combined: single 1-hour slot, taught to combined batches together
            // Add one requirement per theory hour
            const hoursForGroup = sc.theoryHours || 1;
            for (let h = 0; h < hoursForGroup; h++) {
              combinedRequirements.push({
                classId: sc.classId,
                departmentId: sc.departmentId,
                subjectCode: sc.subject.code,
                subjectName: sc.subject.name,
                facultyId: groupFacultyId,
                preferredRoomId: sc.theoryRoomId || null,
                type: 'combined_theory',
                slotType: 'theory',
                batch: null,
                combinedBatches: cg.batches,
                needsLab: false,
                isCombined: true,
                constraintTightness: 12
              });
            }
          }
        }
      }
      // --- Standard batch practicals → collect for rotation grouping ---
      else if (sc.batches && sc.batches.length > 0) {
        const classKey = sc.classId.toString();
        if (!practicalsByClass[classKey]) practicalsByClass[classKey] = [];

        for (const batchConfig of sc.batches) {
          practicalsByClass[classKey].push({
            subjectCode: sc.subject.code,
            subjectName: sc.subject.name,
            batchLabel: batchConfig.batchLabel,
            facultyId: batchConfig.facultyId,
            labId: batchConfig.labId,
            hours: batchConfig.hours || 2,
            departmentId: sc.departmentId,
            isCrossDeptFaculty: sc.isCrossDeptFaculty
          });
        }
      }
    }

    // ═══════════════════════════════════════════
    // PHASE 5b: Build practical ROTATION BLOCKS
    // ═══════════════════════════════════════════
    // Pattern: All batches have practicals at the SAME time,
    //          each batch doing a DIFFERENT subject (Latin-square rotation)
    if (io) io.emit('generation-progress', { semesterId, percent: 35, message: 'Building practical rotation blocks...' });

    const rotationBlocks = [];

    for (const [classId, practicals] of Object.entries(practicalsByClass)) {
      const cls = classes.find(c => c._id.toString() === classId);
      if (!cls) continue;

      // Group by subject to get unique subjects
      const subjectMap = {};
      for (const p of practicals) {
        if (!subjectMap[p.subjectCode]) {
          subjectMap[p.subjectCode] = {
            subjectCode: p.subjectCode,
            subjectName: p.subjectName,
            departmentId: p.departmentId,
            batchAssignments: {}   // batchLabel -> { facultyId, labId }
          };
        }
        subjectMap[p.subjectCode].batchAssignments[p.batchLabel] = {
          facultyId: p.facultyId,
          labId: p.labId,
          hours: p.hours
        };
      }

      const subjects = Object.values(subjectMap);
      const batchLabels = cls.batchLabels || ['B1', 'B2', 'B3', 'B4'];
      const numBatches = batchLabels.length;
      const numSubjects = subjects.length;

      if (numSubjects === 0) continue;

      // Determine how many rotation sessions are needed.
      // Each batch needs to do each subject once (2-hour session).
      // In each rotation block, we assign min(numBatches, numSubjects) subjects,
      // using a circular rotation pattern.
      //
      // Example: 4 subjects (DAV,CSS,SEPM,ML), 4 batches (B1,B2,B3,B4):
      //   Block 0: B1→DAV, B2→CSS, B3→SEPM, B4→ML
      //   Block 1: B1→CSS, B2→SEPM, B3→ML,   B4→DAV
      //   Block 2: B1→SEPM, B2→ML,  B3→DAV,  B4→CSS
      //   Block 3: B1→ML,   B2→DAV, B3→CSS,  B4→SEPM

      const numBlocks = numSubjects;  // Each subject needs one session per batch
      const departmentId = practicals[0].departmentId;

      for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
        const assignments = [];

        for (let b = 0; b < numBatches; b++) {
          const subjectIdx = (b + blockIdx) % numSubjects;
          const subject = subjects[subjectIdx];
          const batchLabel = batchLabels[b];
          const batchConfig = subject.batchAssignments[batchLabel];

          if (batchConfig) {
            assignments.push({
              batch: batchLabel,
              subjectCode: subject.subjectCode,
              subjectName: subject.subjectName,
              facultyId: batchConfig.facultyId,
              labId: batchConfig.labId,
            });
          }
        }

        if (assignments.length > 0) {
          rotationBlocks.push({
            classId,
            departmentId,
            type: 'rotation_block',
            assignments,
            constraintTightness: 20  // Highest priority — place first
          });
        }
      }
    }

    // ═══════════════════════════════════════════
    // PHASE 6: Sort all requirements
    // ═══════════════════════════════════════════
    // Merge: rotation blocks (highest), combined, then theory
    const allRequirements = [...rotationBlocks, ...combinedRequirements, ...theoryRequirements];
    allRequirements.sort((a, b) => b.constraintTightness - a.constraintTightness);

    // Shuffle within same tightness for variety
    let i = 0;
    while (i < allRequirements.length) {
      let j = i;
      while (j < allRequirements.length && allRequirements[j].constraintTightness === allRequirements[i].constraintTightness) {
        j++;
      }
      for (let k = j - 1; k > i; k--) {
        const r = i + Math.floor(Math.random() * (k - i + 1));
        [allRequirements[k], allRequirements[r]] = [allRequirements[r], allRequirements[k]];
      }
      i = j;
    }

    // ═══════════════════════════════════════════
    // PHASE 7: Assignment
    // ═══════════════════════════════════════════
    if (io) io.emit('generation-progress', { semesterId, percent: 45, message: 'Assigning slots...' });

    const rooms = await Room.find({ isActive: true }).sort({ capacity: -1 });
    let placed = 0;
    const unplaced = [];
    const totalReqs = allRequirements.length;

    // Pre-cache faculty info to avoid repeated DB calls
    const facultyCache = {};
    const getFacultyInfo = async (facultyId) => {
      if (!facultyId) return { name: '', shortCode: '' };
      const fid = facultyId.toString();
      if (facultyCache[fid]) return facultyCache[fid];
      const faculty = await User.findById(facultyId);
      if (!faculty) { facultyCache[fid] = { name: '', shortCode: '' }; return facultyCache[fid]; }
      const fDoc = await FacultyModel.findOne({ email: faculty.email });
      const info = {
        name: faculty.name,
        shortCode: fDoc?.shortCode || faculty.name.split(' ').map(n => n[0]).join('').toUpperCase()
      };
      facultyCache[fid] = info;
      return info;
    };

    // Helper to check if a requirement matches a room's shared batch config
    const isReqInSharedBatchRoom = (req, room, classesList) => {
      if (!room.isSharedBatch) return true; // General room, anyone can use
      if (!room.sharedBatchName) return false;
      
      // Format: "SE1 - B1 + B2"
      const parts = room.sharedBatchName.split(' - ');
      if (parts.length !== 2) return false;
      const batchClassName = parts[0];
      const batchesStr = parts[1];
      const allowedBatches = batchesStr.split(' + ').map(b => b.trim());

      const reqClass = classesList.find(c => c._id.toString() === req.classId.toString());
      if (!reqClass || reqClass.name !== batchClassName) return false;
      
      // If the req is for a specific batch or combined batches
      const targetBatch = req.batch || req.combinedBatches;
      if (!targetBatch) return false; // Theory / all batches
      
      const entryBatches = Array.isArray(targetBatch) 
        ? targetBatch 
        : [targetBatch].filter(Boolean);
        
      return entryBatches.every(b => allowedBatches.includes(b));
    };

    // Helper: find available lab room for a dept
    const findAvailableLab = (day, startTime, deptId, usedRoomIds, req) => {
      const deptAlloc = roomAllocations[deptId?.toString()];
      for (const room of rooms) {
        if (room.type !== 'lab') continue;
        if (usedRoomIds.has(room._id.toString())) continue;
        
        // Filter shared batch rooms
        if (req && !isReqInSharedBatchRoom(req, room, classes)) continue;
        
        const rk = `r-${room._id}-${day}-${startTime}`;
        if (isOccupied(rk)) continue;
        // Check allocation
        if (deptAlloc) {
          const rc = deptAlloc.rooms.find(ra => {
            const raId = ra.roomId?._id ? ra.roomId._id.toString() : ra.roomId.toString();
            return raId === room._id.toString();
          });
          if (rc && !rc.isAccessible) continue;
          if (!rc) continue;
        }
        return room;
      }
      return null;
    };

    for (let ri = 0; ri < allRequirements.length; ri++) {
      const req = allRequirements[ri];

      // Progress updates
      if (ri % 5 === 0 && io) {
        const pct = 45 + Math.floor((ri / totalReqs) * 45);
        io.emit('generation-progress', { semesterId, percent: pct, message: `Placing ${ri + 1}/${totalReqs}...` });
      }

      // ─────────────────────────────────────
      // ROTATION BLOCK: All batches at once
      // ─────────────────────────────────────
      if (req.type === 'rotation_block') {
        let assigned = false;

        const randomDayOffset2 = Math.floor(Math.random() * DAYS.length);
        for (let d = 0; d < DAYS.length; d++) {
          if (assigned) break;
          const day = DAYS[(d + randomDayOffset2) % DAYS.length];

          const randomPairOffset2 = Math.floor(Math.random() * consecutivePairs.length);
          for (let p = 0; p < consecutivePairs.length; p++) {
            if (assigned) break;
            const [ts1, ts2] = consecutivePairs[(p + randomPairOffset2) % consecutivePairs.length];

            // Check class is free for both slots (all batches + classwide)
            let allFree = true;
            for (const a of req.assignments) {
              for (const ts of [ts1, ts2]) {
                if (isOccupied(`c-${req.classId}-${a.batch}-${day}-${ts.startTime}`) ||
                    isOccupied(`c-${req.classId}-all-${day}-${ts.startTime}`)) {
                  allFree = false;
                  break;
                }
              }
              if (!allFree) break;
            }
            if (!allFree) continue;

            // Check ALL faculties are free for both slots
            allFree = true;
            for (const a of req.assignments) {
              if (a.facultyId) {
                for (const ts of [ts1, ts2]) {
                  if (isOccupied(`f-${a.facultyId}-${day}-${ts.startTime}`)) {
                    allFree = false;
                    break;
                  }
                }
              }
              if (!allFree) break;
            }
            if (!allFree) continue;

            // Find a lab room for EACH batch (all must be different rooms)
            const roomAssignments = [];
            let roomsOk = true;
            const usedRoomIds = new Set();

            for (const a of req.assignments) {
              let selectedRoom = null;

              // Try preferred lab first
              if (a.labId) {
                const labIdStr = a.labId.toString();
                const rk1 = `r-${labIdStr}-${day}-${ts1.startTime}`;
                const rk2 = `r-${labIdStr}-${day}-${ts2.startTime}`;
                if (!isOccupied(rk1) && !isOccupied(rk2) && !usedRoomIds.has(labIdStr)) {
                  selectedRoom = rooms.find(r => r._id.toString() === labIdStr);
                }
              }

              // Fallback: find any available lab
              if (!selectedRoom) {
                for (const ts of [ts1]) { // Check both slots
                  selectedRoom = null;
                  for (const room of rooms) {
                    if (room.type !== 'lab') continue;
                    if (usedRoomIds.has(room._id.toString())) continue;
                    
                    // Filter shared batch rooms
                    if (!isReqInSharedBatchRoom({ ...req, batch: a.batch }, room, classes)) continue;

                    const rk1 = `r-${room._id}-${day}-${ts1.startTime}`;
                    const rk2 = `r-${room._id}-${day}-${ts2.startTime}`;
                    if (isOccupied(rk1) || isOccupied(rk2)) continue;
                    selectedRoom = room;
                    break;
                  }
                }
              }

              if (!selectedRoom) {
                roomsOk = false;
                break;
              }

              usedRoomIds.add(selectedRoom._id.toString());
              roomAssignments.push({ ...a, room: selectedRoom });
            }

            if (!roomsOk) continue;

            // ✅ All clear — place all batch entries for BOTH time slots
            const keys = [];
            for (const ra of roomAssignments) {
              for (const ts of [ts1, ts2]) {
                keys.push(`c-${req.classId}-${ra.batch}-${day}-${ts.startTime}`);
                if (ra.facultyId) keys.push(`f-${ra.facultyId}-${day}-${ts.startTime}`);
                keys.push(`r-${ra.room._id}-${day}-${ts.startTime}`);
              }
            }
            // Mark classwide busy for both slots
            keys.push(`c-${req.classId}-all-${day}-${ts1.startTime}`);
            keys.push(`c-${req.classId}-all-${day}-${ts2.startTime}`);
            markOccupied(keys);

            // Create TimetableSlot entries for each batch × 2 time slots
            for (const ra of roomAssignments) {
              const fInfo = await getFacultyInfo(ra.facultyId);

              for (const ts of [ts1, ts2]) {
                const slotData = {
                  semesterId,
                  department: req.departmentId,
                  classId: req.classId,
                  day,
                  startTime: ts.startTime,
                  endTime: ts.endTime,
                  slotNumber: ts.slotNumber,
                  batch: ra.batch,
                  subjectCode: ra.subjectCode,
                  subjectName: ra.subjectName,
                  facultyId: ra.facultyId,
                  facultyName: fInfo.name,
                  facultyShortCode: fInfo.shortCode,
                  roomId: ra.room._id,
                  roomName: ra.room.name,
                  slotType: 'practical',
                  isLocked: false,
                  isClasswide: false,
                  status: 'draft',
                  createdBy: userId,
                  lastModifiedBy: userId
                };

                const slot = new TimetableSlot(slotData);
                await slot.save();
                placed++;
              }
            }

            assigned = true;
          }
        }

        if (!assigned) {
          unplaced.push({
            classId: req.classId,
            subject: req.assignments.map(a => `${a.batch}:${a.subjectCode}`).join(', '),
            type: 'rotation_block',
            reason: 'No 2-hour slot found where all batch faculties and labs are free'
          });
        }

        continue; // Skip normal placement
      }

      // ─────────────────────────────────────
      // COMBINED practicals (2-hour block)
      // ─────────────────────────────────────
      if (req.type === 'combined') {
        let assigned = false;

        const randomDayOffset3 = Math.floor(Math.random() * DAYS.length);
        for (let d = 0; d < DAYS.length; d++) {
          if (assigned) break;
          const day = DAYS[(d + randomDayOffset3) % DAYS.length];

          const randomPairOffset3 = Math.floor(Math.random() * consecutivePairs.length);
          for (let p = 0; p < consecutivePairs.length; p++) {
            if (assigned) break;
            const [ts1, ts2] = consecutivePairs[(p + randomPairOffset3) % consecutivePairs.length];

            const ck1 = `c-${req.classId}-all-${day}-${ts1.startTime}`;
            const ck2 = `c-${req.classId}-all-${day}-${ts2.startTime}`;
            if (isOccupied(ck1) || isOccupied(ck2)) continue;

            // Check batch keys
            let batchBusy = false;
            for (const bl of (req.combinedBatches || [])) {
              if (isOccupied(`c-${req.classId}-${bl}-${day}-${ts1.startTime}`) ||
                  isOccupied(`c-${req.classId}-${bl}-${day}-${ts2.startTime}`)) {
                batchBusy = true;
                break;
              }
            }
            if (batchBusy) continue;

            // Faculty busy?
            if (req.facultyId) {
              if (isOccupied(`f-${req.facultyId}-${day}-${ts1.startTime}`) ||
                  isOccupied(`f-${req.facultyId}-${day}-${ts2.startTime}`)) continue;
            }

            // Room
            let selectedRoom = null;
            if (req.roomId) {
              const rk1 = `r-${req.roomId}-${day}-${ts1.startTime}`;
              const rk2 = `r-${req.roomId}-${day}-${ts2.startTime}`;
              if (!isOccupied(rk1) && !isOccupied(rk2)) {
                selectedRoom = rooms.find(r => r._id.toString() === req.roomId.toString());
              }
            }
            if (!selectedRoom) {
              const usedIds = new Set();
              selectedRoom = findAvailableLab(day, ts1.startTime, req.departmentId, usedIds, req);
              if (selectedRoom) {
                const rk2 = `r-${selectedRoom._id}-${day}-${ts2.startTime}`;
                if (isOccupied(rk2)) selectedRoom = null;
              }
            }
            if (!selectedRoom) continue;

            // Place
            const keys = [ck1, ck2];
            for (const bl of (req.combinedBatches || [])) {
              keys.push(`c-${req.classId}-${bl}-${day}-${ts1.startTime}`);
              keys.push(`c-${req.classId}-${bl}-${day}-${ts2.startTime}`);
            }
            if (req.facultyId) {
              keys.push(`f-${req.facultyId}-${day}-${ts1.startTime}`);
              keys.push(`f-${req.facultyId}-${day}-${ts2.startTime}`);
            }
            keys.push(`r-${selectedRoom._id}-${day}-${ts1.startTime}`);
            keys.push(`r-${selectedRoom._id}-${day}-${ts2.startTime}`);
            markOccupied(keys);

            const fInfo = await getFacultyInfo(req.facultyId);
            for (const ts of [ts1, ts2]) {
              const slot = new TimetableSlot({
                semesterId,
                department: req.departmentId,
                classId: req.classId,
                day,
                startTime: ts.startTime,
                endTime: ts.endTime,
                slotNumber: ts.slotNumber,
                batch: null,
                subjectCode: req.subjectCode,
                subjectName: req.subjectName,
                facultyId: req.facultyId,
                facultyName: fInfo.name,
                facultyShortCode: fInfo.shortCode,
                roomId: selectedRoom._id,
                roomName: selectedRoom.name,
                slotType: 'combined',
                isLocked: false,
                isClasswide: false,
                combinedBatches: req.combinedBatches || [],
                status: 'draft',
                createdBy: userId,
                lastModifiedBy: userId
              });
              await slot.save();
              placed++;
            }
            assigned = true;
          }
        }

        if (!assigned) {
          unplaced.push({
            classId: req.classId,
            subject: req.subjectCode,
            type: 'combined',
            reason: 'No valid 2-hour slot found'
          });
        }
        continue;
      }

      // ─────────────────────────────────────
      // COMBINED THEORY (single-slot, batches taught together)
      // ─────────────────────────────────────
      if (req.type === 'combined_theory') {
        let assigned = false;

        const randomDayOffset = Math.floor(Math.random() * DAYS.length);
        for (let d = 0; d < DAYS.length; d++) {
          if (assigned) break;
          const day = DAYS[(d + randomDayOffset) % DAYS.length];

          const randomSlotOffset = Math.floor(Math.random() * timeSlots.length);
          for (let s = 0; s < timeSlots.length; s++) {
            if (assigned) break;
            const ts = timeSlots[(s + randomSlotOffset) % timeSlots.length];

            // Check combined batch keys
            let batchBusy = false;
            for (const bl of (req.combinedBatches || [])) {
              if (isOccupied(`c-${req.classId}-${bl}-${day}-${ts.startTime}`) ||
                  isOccupied(`c-${req.classId}-all-${day}-${ts.startTime}`)) {
                batchBusy = true;
                break;
              }
            }
            if (batchBusy) continue;

            // Faculty busy?
            if (req.facultyId) {
              if (isOccupied(`f-${req.facultyId}-${day}-${ts.startTime}`)) continue;
            }

            // Find room (try preferred room first, then any classroom)
            let selectedRoom = null;

            // Try preferred room first
            if (req.preferredRoomId) {
              const prefRoomKey = `r-${req.preferredRoomId}-${day}-${ts.startTime}`;
              if (!isOccupied(prefRoomKey)) {
                selectedRoom = rooms.find(r => r._id.toString() === req.preferredRoomId.toString());
              }
            }

            // Fallback: find any available classroom
            if (!selectedRoom) {
              const deptAlloc = roomAllocations[req.departmentId.toString()];
              const candidates = [];
              for (const room of rooms) {
                if (room.type === 'lab') continue; // Theory doesn't need lab
                const roomKey = `r-${room._id}-${day}-${ts.startTime}`;
                if (isOccupied(roomKey)) continue;

                // Filter shared batch rooms
                if (!isReqInSharedBatchRoom(req, room, classes)) continue;

                if (deptAlloc) {
                  const roomConfig = deptAlloc.rooms.find(ra => {
                    const raId = ra.roomId?._id ? ra.roomId._id.toString() : ra.roomId.toString();
                    return raId === room._id.toString();
                  });
                  if (roomConfig && !roomConfig.isAccessible) continue;
                  if (!roomConfig) continue;
                  candidates.push({ room, sharePct: roomConfig.sharingPercentage || 100 });
                } else {
                  candidates.push({ room, sharePct: 100 });
                }
              }
              candidates.sort((a, b) => b.sharePct - a.sharePct);
              if (candidates.length > 0) selectedRoom = candidates[0].room;
            }
            if (!selectedRoom) continue;

            // Place: mark combined batch keys as occupied
            const keys = [];
            for (const bl of (req.combinedBatches || [])) {
              keys.push(`c-${req.classId}-${bl}-${day}-${ts.startTime}`);
            }
            if (req.facultyId) keys.push(`f-${req.facultyId}-${day}-${ts.startTime}`);
            keys.push(`r-${selectedRoom._id}-${day}-${ts.startTime}`);
            markOccupied(keys);

            const fInfo = await getFacultyInfo(req.facultyId);
            const slot = new TimetableSlot({
              semesterId,
              department: req.departmentId,
              classId: req.classId,
              day,
              startTime: ts.startTime,
              endTime: ts.endTime,
              slotNumber: ts.slotNumber,
              batch: null,
              subjectCode: req.subjectCode,
              subjectName: req.subjectName,
              facultyId: req.facultyId,
              facultyName: fInfo.name,
              facultyShortCode: fInfo.shortCode,
              roomId: selectedRoom._id,
              roomName: selectedRoom.name,
              slotType: 'theory',
              isLocked: false,
              isClasswide: false,
              combinedBatches: req.combinedBatches || [],
              status: 'draft',
              createdBy: userId,
              lastModifiedBy: userId
            });
            await slot.save();
            placed++;
            assigned = true;
          }
        }

        if (!assigned) {
          unplaced.push({
            classId: req.classId,
            subject: req.subjectCode,
            type: 'combined_theory',
            reason: 'No valid single slot found for combined theory'
          });
        }
        continue;
      }

      // ─────────────────────────────────────
      // THEORY (single-slot placement)
      // ─────────────────────────────────────
      let assigned = false;

      const randomDayOffset = Math.floor(Math.random() * DAYS.length);
      for (let d = 0; d < DAYS.length; d++) {
        if (assigned) break;
        const day = DAYS[(d + randomDayOffset) % DAYS.length];

        const randomSlotOffset = Math.floor(Math.random() * timeSlots.length);
        for (let s = 0; s < timeSlots.length; s++) {
          if (assigned) break;
          const ts = timeSlots[(s + randomSlotOffset) % timeSlots.length];

          // Class busy?
          const classKey = `c-${req.classId}-${req.batch || 'all'}-${day}-${ts.startTime}`;
          if (isOccupied(classKey)) continue;

          // Also check class-wide if this is a batch slot
          if (req.batch) {
            const classWideKey = `c-${req.classId}-all-${day}-${ts.startTime}`;
            if (isOccupied(classWideKey)) continue;
          }

          // Faculty busy?
          if (req.facultyId) {
            const facultyKey = `f-${req.facultyId}-${day}-${ts.startTime}`;
            if (isOccupied(facultyKey)) continue;
          }

          // Find available room
          let selectedRoom = null;
          if (req.preferredRoomId) {
            const roomKey = `r-${req.preferredRoomId}-${day}-${ts.startTime}`;
            if (!isOccupied(roomKey)) {
              selectedRoom = rooms.find(r => r._id.toString() === req.preferredRoomId.toString());
            }
          }

          if (!selectedRoom) {
            const deptAlloc = roomAllocations[req.departmentId.toString()];
            const candidates = [];
            for (const room of rooms) {
              const roomKey = `r-${room._id}-${day}-${ts.startTime}`;
              if (isOccupied(roomKey)) continue;

              // Filter shared batch rooms
              if (!isReqInSharedBatchRoom(req, room, classes)) continue;

              if (deptAlloc) {
                const roomConfig = deptAlloc.rooms.find(ra => {
                  const raId = ra.roomId?._id ? ra.roomId._id.toString() : ra.roomId.toString();
                  return raId === room._id.toString();
                });
                if (roomConfig && !roomConfig.isAccessible) continue;
                if (!roomConfig) continue;
                const sharePct = roomConfig.sharingPercentage || 100;
                candidates.push({ room, sharePct });
              } else {
                candidates.push({ room, sharePct: 100 });
              }
            }

            candidates.sort((a, b) => b.sharePct - a.sharePct);

            for (const { room } of candidates) {
              if (req.needsLab && room.type !== 'lab') continue;
              if (!req.needsLab && room.type === 'lab') continue;
              selectedRoom = room;
              break;
            }
          }

          if (!selectedRoom) continue;

          // Assign
          const keys = [classKey];
          if (req.facultyId) keys.push(`f-${req.facultyId}-${day}-${ts.startTime}`);
          keys.push(`r-${selectedRoom._id}-${day}-${ts.startTime}`);

          // If theory (batch=null), mark all batch keys too
          if (!req.batch) {
            const cls = classes.find(c => c._id.toString() === req.classId.toString());
            if (cls) {
              for (const bl of cls.batchLabels) {
                keys.push(`c-${req.classId}-${bl}-${day}-${ts.startTime}`);
              }
            }
          }

          markOccupied(keys);

          const fInfo = await getFacultyInfo(req.facultyId);

          const slotData = {
            semesterId,
            department: req.departmentId,
            classId: req.classId,
            day,
            startTime: ts.startTime,
            endTime: ts.endTime,
            slotNumber: ts.slotNumber,
            batch: req.batch,
            subjectCode: req.subjectCode,
            subjectName: req.subjectName,
            facultyId: req.facultyId,
            facultyName: fInfo.name,
            facultyShortCode: fInfo.shortCode,
            roomId: selectedRoom._id,
            roomName: selectedRoom.name,
            slotType: req.slotType,
            isLocked: false,
            isClasswide: !req.batch,
            combinedBatches: req.combinedBatches || [],
            status: 'draft',
            createdBy: userId,
            lastModifiedBy: userId
          };

          const slot = new TimetableSlot(slotData);
          await slot.save();
          placed++;
          assigned = true;
        }
      }

      if (!assigned) {
        unplaced.push({
          classId: req.classId,
          subject: req.subjectCode,
          batch: req.batch,
          type: req.type,
          reason: 'No valid slot found'
        });
      }
    }

    // ═══════════════════════════════════════════
    // PHASE 8: Finalize
    // ═══════════════════════════════════════════
    if (io) io.emit('generation-progress', { semesterId, percent: 95, message: 'Finalizing...' });

    config.transitionTo('draft_generated', userId, `Generated ${placed}/${totalReqs} entries`);
    await config.save();

    const result = {
      message: `Timetable generated: ${placed}/${totalReqs + fixedSlots.length} entries placed (${rotationBlocks.length} rotation blocks).`,
      totalRequired: totalReqs + fixedSlots.length,
      placed: placed + fixedSlots.length,
      unplaced: unplaced.length,
      unplacedDetails: unplaced,
      rotationBlocksPlaced: rotationBlocks.length - unplaced.filter(u => u.type === 'rotation_block').length
    };

    if (io) {
      io.emit('generation-complete', { semesterId, ...result });
      io.emit('semester-state-changed', { semesterId, newState: 'draft_generated' });
    }

    return result;

  } catch (error) {
    // Rollback state
    config.generationState = 'ready_to_generate';
    config.stateHistory.push({
      state: 'ready_to_generate',
      changedBy: userId,
      changedAt: new Date(),
      note: `Generation failed: ${error.message}`
    });
    await config.save();
    throw error;
  }
}

module.exports = { generateTimetable };
