const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Patient = require('../models/Patient');
const generateId = require('../utils/generateId');

// GET /api/doctors
exports.getAllDoctors = async (req, res) => {
  try {
    const { search, zone } = req.query;
    const filter = {};
    if (zone) filter.zone = zone;
    if (search) {
      filter.$or = [
        { doctorName: { $regex: search, $options: 'i' } },
        { doctorId: { $regex: search, $options: 'i' } },
        { specialty: { $regex: search, $options: 'i' } },
      ];
    }
    const doctors = await Doctor.find(filter).sort({ createdAt: -1 }).populate('assignedPRTs', 'name loginEmail');
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch doctors', error: err.message });
  }
};

// GET /api/doctors/:id
exports.getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate('assignedPRTs', 'name loginEmail');
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch doctor', error: err.message });
  }
};

// POST /api/doctors  (Admin: "Add New Doctor")
exports.createDoctor = async (req, res) => {
  try {
    const { doctorName, phoneNumber, email, clinicLocation, specialty, zone } = req.body;
    if (!doctorName || !phoneNumber || !clinicLocation || !specialty || !zone) {
      return res.status(400).json({ message: 'Missing required doctor fields' });
    }

    const doctorId = await generateId(Doctor, 'doctorId', 'DOC', { withYear: true, padding: 4 });

    const doctor = await Doctor.create({
      doctorId,
      doctorName,
      phoneNumber,
      email,
      clinicLocation,
      specialty,
      zone,
    });

    res.status(201).json(doctor);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create doctor', error: err.message });
  }
};

// PUT /api/doctors/:id
exports.updateDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const editableFields = ['doctorName', 'phoneNumber', 'email', 'clinicLocation', 'specialty', 'zone'];
    editableFields.forEach((f) => {
      if (req.body[f] !== undefined) doctor[f] = req.body[f];
    });

    await doctor.save();
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update doctor', error: err.message });
  }
};

// DELETE /api/doctors/:id
exports.deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndDelete(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    res.json({ message: 'Doctor deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete doctor', error: err.message });
  }
};

// POST /api/doctors/map  (Admin: "Map Doctor To PRT")
exports.mapDoctorToPrt = async (req, res) => {
  try {
    const { doctorId, prtId } = req.body;
    if (!doctorId || !prtId) return res.status(400).json({ message: 'doctorId and prtId are required' });

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    if (!doctor.assignedPRTs.map(String).includes(String(prtId))) {
      doctor.assignedPRTs.push(prtId);
      await doctor.save();
    }

    const populated = await doctor.populate('assignedPRTs', 'name loginEmail');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to map doctor to PRT', error: err.message });
  }
};

// DELETE /api/doctors/:id/map/:prtId
exports.unmapDoctorFromPrt = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    doctor.assignedPRTs = doctor.assignedPRTs.filter((p) => String(p) !== String(req.params.prtId));
    await doctor.save();
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: 'Failed to unmap doctor', error: err.message });
  }
};

// POST /api/doctors/:id/create-login  (Admin only — gives a doctor portal access)
exports.createDoctorLogin = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const { loginEmail, password } = req.body;
    if (!loginEmail || !password) {
      return res.status(400).json({ message: 'loginEmail and password are required' });
    }

    const existing = await User.findOne({ loginEmail: loginEmail.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: 'A login with this email already exists' });

    const user = await User.create({
      name: doctor.doctorName,
      loginEmail: loginEmail.toLowerCase().trim(),
      userEmail: loginEmail.toLowerCase().trim(),
      password,
      role: 'doctor',
      linkedDoctor: doctor._id,
    });

    const obj = user.toObject();
    delete obj.password;
    res.status(201).json(obj);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create doctor login', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Doctor portal — "My PRTs" panel (doctor role only).
// Deliberately returns only GENERAL PRT details (name, id, zone, state, HQ) and
// the patients that doctor shares with that PRT — never contact info, emails,
// agency, manager, or anything about other doctors' patients.
// ---------------------------------------------------------------------------

// GET /api/doctors/me/prts  — PRTs mapped to the logged-in doctor, with a patient count each
exports.getMyMappedPrts = async (req, res) => {
  try {
    if (!req.user.linkedDoctor) {
      return res.status(404).json({ message: 'No doctor profile is linked to this login' });
    }
    const doctor = await Doctor.findById(req.user.linkedDoctor).populate(
      'assignedPRTs',
      'prtId name zone state hq isInactive'
    );
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    const prts = (doctor.assignedPRTs || []).filter(Boolean);

    const counts = await Patient.aggregate([
      { $match: { assignedDoctor: doctor._id, addedBy: { $in: prts.map((p) => p._id) } } },
      { $group: { _id: '$addedBy', count: { $sum: 1 } } },
    ]);
    const countByPrt = new Map(counts.map((c) => [String(c._id), c.count]));

    res.json(
      prts.map((p) => ({
        _id: p._id,
        prtId: p.prtId,
        name: p.name,
        zone: p.zone,
        state: p.state,
        hq: p.hq,
        isInactive: p.isInactive,
        patientCount: countByPrt.get(String(p._id)) || 0,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch your PRTs', error: err.message });
  }
};

// GET /api/doctors/me/prts/:prtId — general details of one mapped PRT + the patients shared with this doctor
exports.getMyMappedPrtById = async (req, res) => {
  try {
    const { prtId } = req.params;
    if (!mongoose.isValidObjectId(prtId)) return res.status(400).json({ message: 'Invalid PRT id' });
    if (!req.user.linkedDoctor) {
      return res.status(404).json({ message: 'No doctor profile is linked to this login' });
    }

    const doctor = await Doctor.findById(req.user.linkedDoctor);
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    if (!doctor.assignedPRTs.map(String).includes(String(prtId))) {
      return res.status(403).json({ message: 'This PRT is not mapped to you' });
    }

    const prt = await User.findById(prtId).select('prtId name zone state hq isInactive');
    if (!prt) return res.status(404).json({ message: 'PRT not found' });

    const patients = await Patient.find({ assignedDoctor: doctor._id, addedBy: prt._id })
      .sort({ createdAt: -1 })
      .select('patientId name age gender lungCondition createdAt');

    res.json({ prt, patients });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch PRT details', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// PRT portal — "My Doctors" panel (PRT role only).
// Mirror of the doctor-side "My PRTs" panel. Returns only GENERAL doctor details
// (id, name, specialty, clinic location, zone) — never phone, email, or the
// other PRTs mapped to that doctor — plus ONLY this PRT's own patients with
// that doctor.
// "Related doctor" = a doctor an admin mapped to this PRT, or a doctor this PRT
// has registered a patient with (same definition the dashboard "Doctors" count uses).
// ---------------------------------------------------------------------------

const GENERAL_DOCTOR_FIELDS = 'doctorId doctorName specialty clinicLocation zone';

async function getRelatedDoctorIds(prtUserId) {
  const mapped = await Doctor.find({ assignedPRTs: prtUserId }).distinct('_id');
  const viaPatients = await Patient.find({ addedBy: prtUserId }).distinct('assignedDoctor');
  const ids = new Map();
  [...mapped, ...viaPatients].filter(Boolean).forEach((id) => ids.set(String(id), id));
  return [...ids.values()];
}

// GET /api/doctors/me/doctors — doctors related to the logged-in PRT, with this PRT's patient count each
exports.getMyDoctors = async (req, res) => {
  try {
    const doctorIds = await getRelatedDoctorIds(req.user._id);
    const doctors = await Doctor.find({ _id: { $in: doctorIds } })
      .select(GENERAL_DOCTOR_FIELDS)
      .sort({ doctorName: 1 });

    const counts = await Patient.aggregate([
      { $match: { addedBy: req.user._id, assignedDoctor: { $in: doctorIds } } },
      { $group: { _id: '$assignedDoctor', count: { $sum: 1 } } },
    ]);
    const countByDoctor = new Map(counts.map((c) => [String(c._id), c.count]));

    res.json(
      doctors.map((d) => ({
        _id: d._id,
        doctorId: d.doctorId,
        doctorName: d.doctorName,
        specialty: d.specialty,
        clinicLocation: d.clinicLocation,
        zone: d.zone,
        patientCount: countByDoctor.get(String(d._id)) || 0,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch your doctors', error: err.message });
  }
};

// GET /api/doctors/me/doctors/:doctorId — general details of one related doctor + this PRT's patients with them
exports.getMyDoctorById = async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!mongoose.isValidObjectId(doctorId)) return res.status(400).json({ message: 'Invalid doctor id' });

    const relatedIds = (await getRelatedDoctorIds(req.user._id)).map(String);
    if (!relatedIds.includes(String(doctorId))) {
      return res.status(403).json({ message: 'This doctor is not linked to you' });
    }

    const doctor = await Doctor.findById(doctorId).select(GENERAL_DOCTOR_FIELDS);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const patients = await Patient.find({ assignedDoctor: doctor._id, addedBy: req.user._id })
      .sort({ createdAt: -1 })
      .select('patientId name age gender lungCondition createdAt');

    res.json({ doctor, patients });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch doctor details', error: err.message });
  }
};