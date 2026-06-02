import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import dbConnect from '../lib/db.js';
import Product from '../models/Product.js';

async function fix() {
  await dbConnect();
  
  const products = await Product.find({ tenantId: 'root' });
  let fixedCount = 0;
  for (const p of products) {
    let price = p.price || 0;
    
    // For variable products, if the parent price is 0, use the minimum price of its variants
    if (p.productType === 'variable' && p.variantCombinations?.length > 0) {
      const prices = p.variantCombinations.map(v => v.price).filter(price => price > 0);
      if (prices.length > 0) {
         // Get the lowest price
         price = Math.min(...prices);
      }
    }
    
    // Also if compareAtPrice is missing, we could try to guess, but let's just fix the main price
    if (p.price !== price || p.price === 0) {
       p.price = price;
       await p.save();
       fixedCount++;
    }
  }
  console.log(`Fixed prices for ${fixedCount} products.`);
  process.exit(0);
}

fix().catch(err => {
  console.error(err);
  process.exit(1);
});
