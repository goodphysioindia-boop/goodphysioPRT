const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    patientId: { type: String, unique: true }, // PAT-YYYY-XXXX

    // Section 1: Basic Info
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
    phoneNumber: { type: String, required: true, trim: true, unique: true },
    email: { type: String, trim: true, lowercase: true },

    // Section 2: Doctor & Clinical Info
    assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    lungCondition: { type: String, required: true, trim: true }, // Primary Diagnosis
    secondaryConditions: [{ type: String }], // Comorbidities
    timeSlot: { type: String, trim: true },
    reasonNotJoiningOnline: { type: String, trim: true },
    languageForSession: { type: String, trim: true },
    isPatientNewOrOld: { type: String, enum: ['New', 'Old'], default: 'New' },

    // Section 3: Document Upload
    consentFormUrl: { type: String, required: true },
    consentFormPublicId: { type: String },

    // Subscription: every patient starts with a 7-day free trial from the start
    // date chosen at registration; staff can then activate / extend it (with the
    // payment mode). Dates are plain calendar dates (YYYY-MM-DD), end inclusive.
    // A patient with no subscription data at all (registered before this existed)
    // is treated as active.
    subscription: {
      plan: { type: String, enum: ['trial', 'paid'] },
      startDate: { type: String },
      endDate: { type: String },
      paymentMode: { type: String, enum: ['Online', 'Cash'] },
    },
    subscriptionHistory: [
      {
        plan: { type: String, enum: ['trial', 'paid'] },
        startDate: String,
        endDate: String,
        paymentMode: { type: String, enum: ['Online', 'Cash'] },
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        recordedAt: { type: Date, default: Date.now },
      },
    ],

    // Ownership
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addedByPrtEmail: { type: String, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

patientSchema.index({ name: 'text', lungCondition: 'text' });

module.exports = mongoose.model('Patient', patientSchema);