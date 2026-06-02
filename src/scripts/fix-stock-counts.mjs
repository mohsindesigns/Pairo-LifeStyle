import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import dbConnect from '../lib/db.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

async function fix() {
  await dbConnect();
  
  // Fix Products Stock
  const products = await Product.find({ tenantId: 'root' });
  let fixedCount = 0;
  for (const p of products) {
    let stock = p.stock || 0;
    // Calculate from variations if variable
    if (p.productType === 'variable' && p.variantCombinations?.length > 0) {
      stock = p.variantCombinations.reduce((acc, v) => acc + (v.stock || 0), 0);
    }
    
    // If it's still 0, we'll force it to have stock because Woo variations
    // might not have stock explicitly set in the CSV but were 'In Stock'
    if (stock === 0) {
      stock = 50; // default safe stock for imported items that were supposedly in stock
    }
    
    p.stock = stock;
    p.availabilityStatus = 'In Stock';
    await p.save();
    fixedCount++;
  }
  console.log(`Fixed stock for ${fixedCount} products.`);
  
  // Fix Category Counts
  const categories = await Category.find({ type: 'product' });
  let catFixedCount = 0;
  for (const c of categories) {
    const count = await Product.countDocuments({ tenantId: 'root', categories: c._id });
    c.productCount = count;
    await c.save();
    catFixedCount++;
  }
  console.log(`Fixed productCount for ${catFixedCount} categories.`);
  
  process.exit(0);
}

fix().catch(err => {
  console.error(err);
  process.exit(1);
});
