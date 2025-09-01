import mongoose, { Schema, Document } from 'mongoose';

export interface IExtractedData extends Document {
  documentType: string;
  pageNumber: number;
  extractedData: any;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExtractedDataSchema = new Schema<IExtractedData>({
  documentType: {
    type: String,
    required: true,
    enum: ['passport', 'aadhaar', 'pan-card']
  },
  pageNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 2
  },
  extractedData: {
    type: Schema.Types.Mixed,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model<IExtractedData>('ExtractedData', ExtractedDataSchema); 