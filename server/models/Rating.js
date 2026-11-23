const mongoose = require('mongoose');

// A patient's star rating (1-5) of how their session went. A patient gives at
// most one rating per day — rating again the same day just changes it.
// Only admins can read these back (see patientController.getRatings).
const ratingSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
    day: { type: String, required: true }, // YYYY-MM-DD the rating was given for
  },
  { timestamps: true }
);

ratingSchema.index({ patient: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);