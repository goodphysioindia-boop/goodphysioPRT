const mongoose = require('mongoose');

// "Tags" a patient's profile for exercise videos. Only patients with enabled = true get the
// Videos section in their portal, and they only see the videos listed here.
const patientVideoAccessSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, unique: true },
    enabled: { type: Boolean, default: true },
    videos: [
      {
        video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
        assignedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    enabledAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PatientVideoAccess', patientVideoAccessSchema);