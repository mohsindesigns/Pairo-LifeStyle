import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

import dbConnect from '../lib/db.js';
import Product from '../models/Product.js';

async function cleanup() {
  await dbConnect();
  console.log("Connected to MongoDB.");
  
  // Pull nulls from categories
  const res = await Product.updateMany({}, { $pull: { categories: null } });
  console.log("Cleaned up null categories:", res);

  // Mark all imported products as In Stock since they were showing as out of stock
  const resStock = await Product.updateMany(
     { stock: { $in: [0, null] }, manageStock: true }, 
     { $set: { stock: 10 } }
  );
  console.log("Set default stock for out-of-stock products:", resStock);

  process.exit(0);
}

cleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
