import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import dbConnect from '../lib/db.js';
import Product from '../models/Product.js';

async function fix() {
  await dbConnect();
  
  const result = await Product.updateMany(
    { tenantId: 'root' },
    { $set: { tenantId: 'DEFAULT_STORE' } }
  );
  
  console.log(`Fixed tenantId for ${result.modifiedCount} products.`);
  process.exit(0);
}

fix().catch(console.error);
