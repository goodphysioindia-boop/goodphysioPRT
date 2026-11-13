const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Exercise videos go to their own Cloudinary folder as video resources.
// (The shared image/PDF upload middleware is left untouched.)
const MAX_MB = 100; // Cloudinary's free plan caps a single video at 100 MB

const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: 'prt-health-app/exercise-videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv', '3gp'],
    public_id: `video-${Date.now()}`,
  }),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      return cb(Object.assign(new Error('Please choose a video file (MP4, MOV or WebM).'), { status: 400 }));
    }
    cb(null, true);
  },
});

// Wraps multer so upload problems come back as a readable JSON message
const uploadVideo = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: `This video is too large. Maximum size is ${MAX_MB} MB.` });
    }
    return res.status(err.status || 500).json({ message: err.message || 'Video upload failed' });
  });
};

module.exports = { uploadVideo, MAX_MB };