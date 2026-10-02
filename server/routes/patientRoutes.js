const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  createSession,
  updateSessionPostVitals,
  getPatientSessions,
  addPatientMedicine,
  getPatientMedicines,
  createPatientLogin,
  setSubscription,
  addRating,
  getRatings,
} = require('../controllers/patientController');

router.use(protect);

// Reads: any logged-in role can call these — visibility is scoped per-role
// inside the controller (PRT sees own, Doctor sees assigned, Patient sees self).
router.get('/', getAllPatients);
router.get('/:id', getPatientById);
router.get('/:id/sessions', getPatientSessions);
router.get('/:id/medicines', getPatientMedicines);

// Ratings: patients give them, only admins (and the patient themself, for their own
// current stars) can read them back.
router.get('/:id/ratings', authorize('admin', 'patient'), getRatings);
router.post('/:id/ratings', authorize('patient'), addRating);

// Writes: only PRT and Admin can register patients / log sessions / add medicine data.
// PRTs can only ADD — editing or deleting an existing patient record is Admin-only.
router.post('/', authorize('admin', 'prt'), createPatient);
router.post('/:id/sessions', authorize('admin', 'prt'), createSession);
router.put('/:id/sessions/:sessionId', authorize('admin', 'prt'), updateSessionPostVitals);
router.post('/:id/medicines', authorize('admin', 'prt'), addPatientMedicine);
router.post('/:id/subscription', authorize('admin', 'prt'), setSubscription);

router.put('/:id', authorize('admin'), updatePatient);
router.delete('/:id', authorize('admin'), deletePatient);

// Give a registered patient portal access (Admin only)
router.post('/:id/create-login', authorize('admin'), createPatientLogin);

module.exports = router;