const mongoose = require('mongoose');
const Video = require('../models/Video');
const PatientVideoAccess = require('../models/PatientVideoAccess');
const Patient = require('../models/Patient');
const cloudinary = require('../config/cloudinary');

// Cloudinary can render a still frame of any video: swap the extension for .jpg and add a crop
const thumbnailFor = (url) => {
  if (!url || !url.includes('/video/upload/')) return '';
  return url.replace('/video/upload/', '/video/upload/so_1,w_480,h_270,c_fill/').replace(/\.[a-z0-9]+$/i, '.jpg');
};

// ---------------------------------------------------------------------------
// Video library — admin and PRTs
// The library is shared: everyone who can give videos sees every video. Admin can edit / delete
// any video; a PRT can only edit / delete the ones they uploaded themselves.
// ---------------------------------------------------------------------------

const isAdminUser = (user) => user.role === 'admin';
const ownsVideo = (user, video) => isAdminUser(user) || String(video.uploadedBy?._id || video.uploadedBy) === String(user._id);

// Admin: every patient. PRT: only the patients they registered.
async function visiblePatientIds(user) {
  if (isAdminUser(user)) return null; // null = no restriction
  return Patient.find({ addedBy: user._id }).distinct('_id');
}

// GET /api/videos — whole library, with how many (of your) patients each video is given to
exports.getVideos = async (req, res) => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 }).populate('uploadedBy', 'name role').lean();
    const ids = await visiblePatientIds(req.user);
    const pipeline = [];
    if (ids) pipeline.push({ $match: { patient: { $in: ids } } });
    pipeline.push({ $unwind: '$videos' }, { $group: { _id: '$videos.video', count: { $sum: 1 } } });
    const counts = await PatientVideoAccess.aggregate(pipeline);
    const countBy = new Map(counts.map((c) => [String(c._id), c.count]));
    res.json(
      videos.map((v) => ({
        ...v,
        uploadedBy: undefined,
        uploadedByName: v.uploadedBy?.name || '',
        canManage: ownsVideo(req.user, v),
        assignedCount: countBy.get(String(v._id)) || 0,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch videos', error: err.message });
  }
};

// POST /api/videos — multipart: file + title (+ description, category)
exports.createVideo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Please choose a video to upload' });
    const title = (req.body.title || '').trim();
    if (!title) {
      // Don't leave an orphan file in Cloudinary
      cloudinary.uploader.destroy(req.file.filename, { resource_type: 'video' }).catch(() => {});
      return res.status(400).json({ message: 'Please give the video a title' });
    }
    const video = await Video.create({
      title,
      description: req.body.description || '',
      category: req.body.category || '',
      url: req.file.path,
      thumbnailUrl: thumbnailFor(req.file.path),
      publicId: req.file.filename,
      format: req.file.format,
      bytes: req.file.size,
      duration: req.file.duration,
      uploadedBy: req.user._id,
    });
    res.status(201).json({ ...video.toObject(), canManage: true, assignedCount: 0 });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save video', error: err.message });
  }
};

// PUT /api/videos/:id — rename / re-describe / re-categorise
exports.updateVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: 'Video not found' });
    if (!ownsVideo(req.user, video)) return res.status(403).json({ message: 'You can only edit videos you uploaded' });
    ['title', 'description', 'category'].forEach((f) => {
      if (req.body[f] !== undefined) video[f] = req.body[f];
    });
    if (!video.title || !video.title.trim()) return res.status(400).json({ message: 'Title cannot be empty' });
    await video.save();
    res.json(video);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update video', error: err.message });
  }
};

// DELETE /api/videos/:id — removes the file and takes it away from every patient
exports.deleteVideo = async (req, res) => {
  try {
    const existing = await Video.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Video not found' });
    if (!ownsVideo(req.user, existing)) return res.status(403).json({ message: 'You can only delete videos you uploaded' });
    const video = await Video.findByIdAndDelete(req.params.id);
    await PatientVideoAccess.updateMany({}, { $pull: { videos: { video: video._id } } });
    if (video.publicId) {
      cloudinary.uploader.destroy(video.publicId, { resource_type: 'video' }).catch(() => {});
    }
    res.json({ message: 'Video deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete video', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Admin / PRT — which patients get which videos (a PRT only ever deals with their own patients)
// ---------------------------------------------------------------------------

// GET /api/videos/access — tagged patients you can manage: { patient, enabled, videoIds }
exports.getAllAccess = async (req, res) => {
  try {
    const ids = await visiblePatientIds(req.user);
    const rows = await PatientVideoAccess.find(ids ? { patient: { $in: ids } } : {}).lean();
    res.json(
      rows.map((r) => ({
        patient: r.patient,
        enabled: r.enabled,
        enabledAt: r.enabledAt,
        videoIds: (r.videos || []).map((v) => v.video),
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch video access', error: err.message });
  }
};

// PUT /api/videos/access/:patientId   body: { enabled: Boolean, videoIds: [id] }
exports.setPatientAccess = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!mongoose.isValidObjectId(patientId)) return res.status(400).json({ message: 'Invalid patient id' });
    const patient = await Patient.findById(patientId).select('_id addedBy');
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    if (!isAdminUser(req.user) && String(patient.addedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only give videos to patients you registered' });
    }

    const enabled = req.body.enabled !== false;
    const requested = Array.isArray(req.body.videoIds) ? req.body.videoIds.map(String) : [];
    const valid = await Video.find({ _id: { $in: requested.filter(mongoose.isValidObjectId) } }).select('_id');
    const validIds = new Set(valid.map((v) => String(v._id)));

    let access = await PatientVideoAccess.findOne({ patient: patientId });
    if (!access) access = new PatientVideoAccess({ patient: patientId });

    // Keep the original assigned date for videos the patient already had
    const existing = new Map((access.videos || []).map((v) => [String(v.video), v.assignedAt]));
    access.videos = requested
      .filter((id) => validIds.has(id))
      .map((id) => ({ video: id, assignedAt: existing.get(id) || new Date() }));

    if (enabled && !access.enabled) access.enabledAt = new Date();
    if (enabled && !access.enabledAt) access.enabledAt = new Date();
    access.enabled = enabled;
    access.updatedBy = req.user._id;
    await access.save();

    res.json({
      patient: access.patient,
      enabled: access.enabled,
      enabledAt: access.enabledAt,
      videoIds: access.videos.map((v) => v.video),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update video access', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Patient portal
// ---------------------------------------------------------------------------

// GET /api/videos/my — the logged-in patient's own videos (only if their profile is tagged)
exports.getMyVideos = async (req, res) => {
  try {
    if (!req.user.linkedPatient) return res.json({ enabled: false, videos: [] });
    const access = await PatientVideoAccess.findOne({ patient: req.user.linkedPatient }).populate(
      'videos.video',
      'title description category url thumbnailUrl duration'
    );
    if (!access || !access.enabled) return res.json({ enabled: false, videos: [] });

    const videos = (access.videos || [])
      .filter((v) => v.video)
      .sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt))
      .map((v) => ({ ...v.video.toObject(), assignedAt: v.assignedAt }));
    res.json({ enabled: true, videos });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch your videos', error: err.message });
  }
};