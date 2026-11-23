const mongoose = require('mongoose');

// An exercise / education video in the admin's library. Admin uploads it once and can then
// give it to any number of patients (see PatientVideoAccess).
const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' }, // e.g. "Breathing", "Knee", "Back pain"
    url: { type: String, required: true },
    // 'upload' = file stored in Cloudinary (default, all older videos); 'youtube' = a pasted YouTube link
    source: { type: String, enum: ['upload', 'youtube'], default: 'upload' },
    youtubeId: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    publicId: { type: String }, // Cloudinary id, used to delete the file
    format: { type: String },
    bytes: { type: Number },
    duration: { type: Number }, // seconds
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Video', videoSchema);