import mongoose from 'mongoose';

const RedirectSchema = new mongoose.Schema({
  oldPath: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true,
    index: true
  },
  newPath: { 
    type: String, 
    required: true, 
    trim: true 
  },
  statusCode: { 
    type: Number, 
    default: 301, 
    enum: [301, 302] 
  }
}, { timestamps: true });

// Ensure clean format on retrieval
// Mongoose 9: pre hooks no longer receive `next` (calling it would throw).
RedirectSchema.pre('save', function () {
  if (this.oldPath) {
    let clean = this.oldPath.trim();
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      try {
        const parsed = new URL(clean);
        clean = parsed.pathname;
      } catch (e) {}
    }
    this.oldPath = clean.toLowerCase().trim();
    if (!this.oldPath.startsWith('/')) {
      this.oldPath = '/' + this.oldPath;
    }
    if (this.oldPath.endsWith('/') && this.oldPath.length > 1) {
      this.oldPath = this.oldPath.slice(0, -1);
    }
  }
  if (this.newPath) {
    this.newPath = this.newPath.trim();
    // Keep absolute URLs intact, but normalize internal paths
    if (!this.newPath.startsWith('http://') && !this.newPath.startsWith('https://')) {
      if (!this.newPath.startsWith('/')) {
        this.newPath = '/' + this.newPath;
      }
      if (this.newPath.endsWith('/') && this.newPath.length > 1) {
        this.newPath = this.newPath.slice(0, -1);
      }
    }
  }
});

delete mongoose.models.Redirect;
export default mongoose.models.Redirect || mongoose.model('Redirect', RedirectSchema);
