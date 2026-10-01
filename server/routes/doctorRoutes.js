const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  mapDoctorToPrt,
  unmapDoctorFromPrt,
  createDoctorLogin,
  getMyMappedPrts,
  getMyMappedPrtById,
  getMyDoctors,
  getMyDoctorById,
} = require('../controllers/doctorController');

router.use(protect);

// Doctor portal: PRTs mapped to the logged-in doctor (kept above '/:id' on purpose)
router.get('/me/prts', authorize('doctor'), getMyMappedPrts);
router.get('/me/prts/:prtId', authorize('doctor'), getMyMappedPrtById);

// PRT portal: doctors related to the logged-in PRT (general details only; also above '/:id')
router.get('/me/doctors', authorize('prt'), getMyDoctors);
router.get('/me/doctors/:doctorId', authorize('prt'), getMyDoctorById);

router.get('/', getAllDoctors); // all logged-in roles can view (needed for patient registration dropdown)
router.get('/:id', getDoctorById);

router.post('/', authorize('admin'), createDoctor);
router.put('/:id', authorize('admin'), updateDoctor);
router.delete('/:id', authorize('admin'), deleteDoctor);

router.post('/map', authorize('admin'), mapDoctorToPrt);
router.delete('/:id/map/:prtId', authorize('admin'), unmapDoctorFromPrt);

// Give a doctor portal access (Admin only)
router.post('/:id/create-login', authorize('admin'), createDoctorLogin);

module.exports = router;