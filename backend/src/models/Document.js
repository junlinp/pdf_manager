import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    title: { type: String, default: '' },
    sourceUrl: { type: String, default: null },
    filePath: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
    fileSize: { type: Number, default: null },
    pageCount: { type: Number, default: null },
    tagIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
  },
  { timestamps: true }
);

documentSchema.index({ title: 'text', filename: 'text', notes: 'text' });

export default mongoose.model('Document', documentSchema);
