const mongoose = require('mongoose');

// A scheduled session (a "batch") created by an admin — or by a PRT / doctor the
// admin has allowed to schedule sessions. This is separate from the per-patient
// clinical `Session` records (pre/post vitals): it describes WHEN a session runs,
// WHO is part of it and the one shared meeting link everyone joins with.
const scheduledSessionSchema = new mongoose.Schema(
  {
    scheduleId: { type: String, unique: true }, // SCH-1001
    name: { type: String, required: true, trim: true },

    // 'group'      -> any number of patients (at least one)
    // 'one-on-one' -> exactly one patient
    mode: { type: String, enum: ['group', 'one-on-one'], required: true },

    // Same options as the existing Add Session form
    sessionType: {
      type: String,
      required: true,
      enum: ['OPD', 'ICU/IPD', 'Home Visit', 'Online', 'Consultation'],
    },

    // Batch window, stored as plain calendar dates (YYYY-MM-DD) so they never
    // shift with timezones. endDate is inclusive.
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    timeSlot: { type: String, required: true, trim: true }, // e.g. "10:30 AM - 11:30 AM"

    // One link shared by every patient in the session
    meetingLink: { type: String, trim: true },

    // Whoever is selected here can see the session
    prts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    doctors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' }],
    patients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Patient' }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

scheduledSessionSchema.index({ prts: 1 });
scheduledSessionSchema.index({ doctors: 1 });
scheduledSessionSchema.index({ patients: 1 });
scheduledSessionSchema.index({ createdBy: 1 });

module.exports = mongoose.model('ScheduledSession', scheduledSessionSchema);