import mongoose from "mongoose";

const ThemeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: false },
  isSystem: { type: Boolean, default: false },

  // Design Tokens
  config: {
    colors: {
      background: { type: String, default: "#FFFFFF" },
      foreground: { type: String, default: "#1A1A1A" },
      primary: { type: String, default: "#1A1A1A" },
      accent: { type: String, default: "#1A1A1A" },
      muted: { type: String, default: "#F2F2F2" },
      secondary: { type: String, default: "#F9F9F9" },
      border: { type: String, default: "rgba(26, 26, 26, 0.06)" },
      card: { type: String, default: "#FFFFFF" }
    },
    typography: {
      headingFont: { type: String, default: "Inter" },
      bodyFont: { type: String, default: "Inter" },
      headingWeight: { type: String, default: "700" },
      bodyWeight: { type: String, default: "400" },
      baseSize: { type: String, default: "16px" },
      headingScale: { type: Number, default: 1.25 } // Modular scale
    },
    ui: {
      borderRadius: { type: String, default: "8px" },
      buttonPadding: { type: String, default: "12px 24px" }
    }
  },

  // Metadata
  previewImage: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" }
}, { timestamps: true });

// Clear Mongoose cache to remove old broken hooks during Next.js hot-reloads
if (mongoose.models.Theme) {
  delete mongoose.models.Theme;
}

export default mongoose.model("Theme", ThemeSchema);
