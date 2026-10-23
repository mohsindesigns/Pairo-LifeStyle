import mongoose from 'mongoose';

const SubmissionSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  email: { type: String, required: true, index: true },
  phone: { type: String },
  subject: { type: String },
  message: { type: String, required: true },
  sourceForm: { type: String, default: 'Contact' },
  sourcePage: { type: String },
  
  status: { 
    type: String, 
    enum: ['New', 'Read', 'Replied', 'Archived', 'Spam', 'Trash'], 
    default: 'New',
    index: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium',
    index: true
  },
  
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', index: true },
  tags: [{ type: String, index: true }],
  
  internalNotes: [{
    content: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    createdAt: { type: Date, default: Date.now }
  }],
  
  attachments: [{
    name: String,
    url: String,
    mimeType: String
  }],
  
  ipAddress: { type: String },
  userAgent: { type: String },
  
  repliedAt: { type: Date },
  lastViewedAt: { type: Date },
  
  // Conversation threading (Future-ready)
  conversationId: { type: String, index: true },
  
  // Soft delete (Trash). 'Trash' stays in the status enum only for older records.
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

// Text indexing for enterprise search
SubmissionSchema.index({ 
  name: 'text', 
  email: 'text', 
  phone: 'text', 
  subject: 'text', 
  message: 'text' 
});

export default mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);
