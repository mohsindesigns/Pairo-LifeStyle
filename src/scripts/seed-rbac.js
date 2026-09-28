const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// Import models using commonJS for script
const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
  permissions: { type: Map, of: [String], default: {} },
  isSystem: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const StaffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  status: { type: String, enum: ['Active', 'Suspended', 'Locked'], default: 'Active' }
}, { timestamps: true });

const Role = mongoose.models.Role || mongoose.model('Role', RoleSchema);
const Staff = mongoose.models.Staff || mongoose.model('Staff', StaffSchema);

const DEFAULT_ROLES = [
  {
    name: 'Super Admin',
    slug: 'super-admin',
    description: 'Full system access. Bypasses all permission checks.',
    isSystem: true,
    permissions: {} // Resolver handles super-admin bypass
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'High-level administrative access to all modules.',
    isSystem: true,
    permissions: {
      products: ['view', 'create', 'edit', 'delete'],
      orders: ['view', 'update', 'refund'],
      customers: ['view', 'edit', 'delete'],
      blogs: ['view', 'create', 'edit', 'publish', 'delete'],
      staff: ['view', 'create', 'edit'],
      promotions: ['view', 'manage'],
      seo: ['view', 'edit', 'sitemap', 'schema'],
      settings: ['view', 'edit'],
      analytics: ['view'],
      media: ['manage']
    }
  },
  {
    name: 'Order Manager',
    slug: 'order-manager',
    description: 'Focuses on fulfillment and order management.',
    isSystem: true,
    permissions: {
      orders: ['view', 'update'],
      customers: ['view'],
      analytics: ['view']
    }
  },
  {
    name: 'Editor',
    slug: 'editor',
    description: 'Manages content, blogs, and product descriptions.',
    isSystem: true,
    permissions: {
      products: ['view', 'edit'],
      blogs: ['view', 'create', 'edit', 'publish', 'delete'],
      media: ['manage']
    }
  }
];

async function seed() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI not found");
    
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");

    // 1. Seed Roles
    for (const roleData of DEFAULT_ROLES) {
      await Role.findOneAndUpdate(
        { slug: roleData.slug },
        roleData,
        { upsert: true, new: true }
      );
      console.log(`Role seeded: ${roleData.name}`);
    }

    // 2. Create Super Admin Staff (If not exists)
    const superAdminRole = await Role.findOne({ slug: 'super-admin' });
    const existingStaff = await Staff.findOne({ email: 'admin@pairo.com' });

    if (!existingStaff) {
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      await Staff.create({
        name: 'Super Admin',
        email: 'admin@pairo.com',
        password: hashedPassword,
        roleId: superAdminRole._id,
        status: 'Active'
      });
      console.log("Super Admin user created: admin@pairo.com / Admin123!");
    }

    console.log("Seeding completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seed();
