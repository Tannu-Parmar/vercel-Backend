// models/PassportSubmission.js
import mongoose from 'mongoose';

const PassportSubmissionSchema = new mongoose.Schema({
  frontPageData: {
    passportNumber: String,
    firstName: String,
    lastName: String,
    nationality: String,
    sex: String,
    dateOfBirth: String,
    placeOfBirth: String,
    placeOfIssue: String,
    maritalStatus: String,
    dateOfIssue: String,
    dateOfExpiry: String,
    isGuardian: Boolean,
    numberOfChildren: String,
  },
  backPageData: {
    fatherName: String,
    motherName: String,
    address: String,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('PassportSubmission', PassportSubmissionSchema);