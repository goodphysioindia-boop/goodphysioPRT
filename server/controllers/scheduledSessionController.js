const ScheduledSession = require('../models/ScheduledSession');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const generateId = require('../utils/generateId');

const MODES = ['group', 'one-on-one'];
const SESSION_TYPES = ['OPD', 'ICU/IPD', 'Home Visit', 'Online', 'Consultation'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const POPULATE = [
  { path: 'prts', select: 'name loginEmail prtId zone' },
  { path: 'doctors', select: 'doctorName doctorId specialty zone' },
  { path: 'patients', select: 'name patientId' },
  { path: 'createdBy', select: 'name role' },
];

const idOf = (x) => String(x?._id || x);

// ---------------- Permissions ----------------

// Admin always; a PRT / doctor only if an admin has switched scheduling on for them.
const canSchedule = (user) =>
  user.role === 'admin' || (['prt', 'doctor'].includes(user.role) && user.canCreateSessions === true);

// Admin can edit/delete ANY session; an allowed PRT/doctor only the ones they created.
const canModify = (session, user) =>
  user.role === 'admin' || (canSchedule(user) && idOf(session.createdBy) === String(user._id));

// Who may see a given session
const canView = (session, user) => {
  if (user.role === 'admin') return true;
  if (idOf(session.createdBy) === String(user._id)) return true;
  if (user.role === 'prt') return (session.prts || []).some((p) => idOf(p) === String(user._id));
  if (user.role === 'doctor' && user.linkedDoctor) {
    return (session.doctors || []).some((d) => idOf(d) === String(user.linkedDoctor));
  }
  if (user.role === 'patient' && user.linkedPatient) {
    return (session.patients || []).some((p) => idOf(p) === String(user.linkedPatient));
  }
  return false;
};

const visibilityFilter = (user) => {
  if (user.role === 'admin') return {};
  const or = [{ createdBy: user._id }];
  if (user.role === 'prt') or.push({ prts: user._id });
  if (user.role === 'doctor' && user.linkedDoctor) or.push({ doctors: user.linkedDoctor });
  if (user.role === 'patient' && user.linkedPatient) or.push({ patients: user.linkedPatient });
  return { $or: or };
};

// Route guard for create / edit / delete
exports.requireScheduler = (req, res, next) => {
  if (!canSchedule(req.user)) {
    return res.status(403).json({ message: 'You are not allowed to schedule sessions. Ask an admin for access.' });
  }
  next();
};

// Shapes a session for the requesting user. Patients must not see who else is
// in a group session, so for them the patient list is reduced to a count.
const shape = (doc, user) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const patientCount = (obj.patients || []).length;
  obj.patientCount = patientCount;
  if (user.role === 'patient') obj.patients = [];
  obj.canEdit = canModify(obj, user);
  return obj;
};

// ---------------- Validation ----------------

const isRealDate = (s) => {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const cleanIds = (arr) => {
  if (!Array.isArray(arr)) return { ids: [], bad: false };
  const ids = [...new Set(arr.map((x) => String(x?._id || x)))];
  return { ids, bad: ids.some((i) => !OBJECT_ID_RE.test(i)) };
};

// Builds + validates the document fields. `existing` is passed on edit so any
// field the client omits keeps its current value.
async function buildData(body, user, existing) {
  const pick = (key) => (body[key] !== undefined ? body[key] : existing ? existing[key] : undefined);

  const name = String(pick('name') || '').trim();
  const mode = pick('mode');
  const sessionType = pick('sessionType');
  const startDate = pick('startDate');
  const endDate = pick('endDate');
  const timeSlot = String(pick('timeSlot') || '').trim();
  const meetingLink = String(pick('meetingLink') || '').trim();

  if (!name) return { error: 'Session name is required' };
  if (!MODES.includes(mode)) return { error: 'Session mode must be Group or One-on-One' };
  if (!SESSION_TYPES.includes(sessionType)) return { error: 'Please choose a valid session type' };
  if (!isRealDate(startDate) || !isRealDate(endDate)) return { error: 'Start date and end date are required' };
  if (endDate < startDate) return { error: 'End date cannot be before the start date' };
  if (!timeSlot) return { error: 'Time slot is required' };
  if (meetingLink && !/^https?:\/\/\S+$/i.test(meetingLink)) {
    return { error: 'Meeting link must start with http:// or https://' };
  }
  if (sessionType === 'Online' && !meetingLink) {
    return { error: 'A meeting link is required for Online sessions' };
  }

  const existingIds = (key) => (existing ? (existing[key] || []).map(idOf) : []);
  const src = (key) => (body[key] !== undefined ? body[key] : existingIds(key));

  const prts = cleanIds(src('prts'));
  const doctors = cleanIds(src('doctors'));
  const patients = cleanIds(src('patients'));
  if (prts.bad || doctors.bad || patients.bad) return { error: 'Invalid participant selected' };

  if (mode === 'one-on-one' && patients.ids.length !== 1) {
    return { error: 'A one-on-one session needs exactly one patient' };
  }
  if (mode === 'group' && patients.ids.length < 1) {
    return { error: 'Select at least one patient for a group session' };
  }

  // Every selected participant must actually exist
  if (prts.ids.length) {
    const n = await User.countDocuments({ _id: { $in: prts.ids }, role: 'prt' });
    if (n !== prts.ids.length) return { error: 'One or more selected PRTs do not exist' };
  }
  if (doctors.ids.length) {
    const n = await Doctor.countDocuments({ _id: { $in: doctors.ids } });
    if (n !== doctors.ids.length) return { error: 'One or more selected doctors do not exist' };
  }
  const np = await Patient.countDocuments({ _id: { $in: patients.ids } });
  if (np !== patients.ids.length) return { error: 'One or more selected patients do not exist' };

  // A non-admin scheduler can only add patients they can already access
  // (PRT: their own patients; doctor: their assigned patients). Patients that
  // were already in the session are left alone.
  if (user.role !== 'admin') {
    const already = new Set(existingIds('patients'));
    const newlyAdded = patients.ids.filter((i) => !already.has(i));
    if (newlyAdded.length) {
      const scope = user.role === 'prt' ? { addedBy: user._id } : { assignedDoctor: user.linkedDoctor };
      const allowed = await Patient.countDocuments({ _id: { $in: newlyAdded }, ...scope });
      if (allowed !== newlyAdded.length) {
        return { error: 'You can only add your own patients to a session' };
      }
    }
  }

  return {
    data: {
      name,
      mode,
      sessionType,
      startDate,
      endDate,
      timeSlot,
      meetingLink,
      prts: prts.ids,
      doctors: doctors.ids,
      patients: patients.ids,
    },
  };
}

// ---------------- Handlers ----------------

// GET /api/scheduled-sessions   (?patient=<id> narrows to sessions containing that patient)
exports.getScheduledSessions = async (req, res) => {
  try {
    const filter = visibilityFilter(req.user);
    if (req.query.patient) {
      if (!OBJECT_ID_RE.test(String(req.query.patient))) return res.json([]);
      filter.patients = req.query.patient;
    }
    const sessions = await ScheduledSession.find(filter).sort({ createdAt: -1 }).populate(POPULATE);
    res.json(sessions.map((s) => shape(s, req.user)));
  } catch (err) {
    console.error('[scheduled-sessions] fetch failed:', err);
    res.status(500).json({ message: 'Failed to fetch sessions', error: err.message });
  }
};

// GET /api/scheduled-sessions/:id
exports.getScheduledSessionById = async (req, res) => {
  try {
    if (!OBJECT_ID_RE.test(req.params.id)) return res.status(404).json({ message: 'Session not found' });
    const session = await ScheduledSession.findById(req.params.id).populate(POPULATE);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (!canView(session, req.user)) {
      return res.status(403).json({ message: 'You do not have access to this session' });
    }
    res.json(shape(session, req.user));
  } catch (err) {
    console.error('[scheduled-sessions] fetch failed:', err);
    res.status(500).json({ message: 'Failed to fetch session', error: err.message });
  }
};

// POST /api/scheduled-sessions
exports.createScheduledSession = async (req, res) => {
  try {
    const { data, error } = await buildData(req.body, req.user, null);
    if (error) return res.status(400).json({ message: error });

    const scheduleId = await generateId(ScheduledSession, 'scheduleId', 'SCH', { withYear: false, padding: 4 });
    const created = await ScheduledSession.create({ ...data, scheduleId, createdBy: req.user._id });
    const populated = await ScheduledSession.findById(created._id).populate(POPULATE);
    res.status(201).json(shape(populated, req.user));
  } catch (err) {
    console.error('[scheduled-sessions] create failed:', err);
    res.status(500).json({ message: 'Failed to create session', error: err.message });
  }
};

// PUT /api/scheduled-sessions/:id   (admin: any session; allowed PRT/doctor: only their own)
exports.updateScheduledSession = async (req, res) => {
  try {
    if (!OBJECT_ID_RE.test(req.params.id)) return res.status(404).json({ message: 'Session not found' });
    const session = await ScheduledSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (!canModify(session, req.user)) {
      return res.status(403).json({ message: 'You can only edit sessions you created' });
    }

    const { data, error } = await buildData(req.body, req.user, session);
    if (error) return res.status(400).json({ message: error });

    Object.assign(session, data);
    await session.save();
    const populated = await ScheduledSession.findById(session._id).populate(POPULATE);
    res.json(shape(populated, req.user));
  } catch (err) {
    console.error('[scheduled-sessions] update failed:', err);
    res.status(500).json({ message: 'Failed to update session', error: err.message });
  }
};

// DELETE /api/scheduled-sessions/:id
exports.deleteScheduledSession = async (req, res) => {
  try {
    if (!OBJECT_ID_RE.test(req.params.id)) return res.status(404).json({ message: 'Session not found' });
    const session = await ScheduledSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (!canModify(session, req.user)) {
      return res.status(403).json({ message: 'You can only delete sessions you created' });
    }
    await ScheduledSession.findByIdAndDelete(req.params.id);
    res.json({ message: 'Session deleted' });
  } catch (err) {
    console.error('[scheduled-sessions] delete failed:', err);
    res.status(500).json({ message: 'Failed to delete session', error: err.message });
  }
};