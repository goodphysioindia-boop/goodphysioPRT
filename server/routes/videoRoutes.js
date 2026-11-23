const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadVideo } = require('../middleware/videoUpload');
const {
  getVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  getAllAccess,
  setPatientAccess,
  getMyVideos,
} = require('../controllers/videoController');

router.use(protect);

// Patient portal (kept above '/:id')
router.get('/my', authorize('patient'), getMyVideos);

// Admin + PRT: who gets which videos (a PRT is limited to their own patients in the controller)
router.get('/access', authorize('admin', 'prt'), getAllAccess);
router.put('/access/:patientId', authorize('admin', 'prt'), setPatientAccess);

// Admin + PRT: video library (a PRT can only edit / delete their own uploads, enforced in the controller)
router.get('/', authorize('admin', 'prt'), getVideos);
router.post('/', authorize('admin', 'prt'), uploadVideo, createVideo);
router.put('/:id', authorize('admin', 'prt'), updateVideo);
router.delete('/:id', authorize('admin', 'prt'), deleteVideo);

module.exports = router;