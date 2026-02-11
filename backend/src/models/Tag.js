import mongoose from 'mongoose';

const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    color: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Tag', tagSchema);
