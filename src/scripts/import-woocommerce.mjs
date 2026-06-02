import fs from 'fs';
import csv from 'csv-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env.local');

dotenv.config({ path: envPath });

import dbConnect from '../lib/db.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

async function importProducts() {
  await dbConnect();
  console.log("Connected to MongoDB. Starting import...");

  const results = [];
  const csvFile = path.resolve(__dirname, '../../wc-product-export-2-6-2026-1780399951676.csv');

  fs.createReadStream(csvFile)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.log(`Parsed ${results.length} rows from CSV.`);

      // Extract unique categories
      const categoryNames = new Set();
      for (const row of results) {
        if (row.Categories) {
          row.Categories.split(',').forEach(c => {
            const trimmed = c.split('>').pop().trim();
            if (trimmed) categoryNames.add(trimmed);
          });
        }
      }

      console.log(`Found ${categoryNames.size} unique categories. Syncing with database...`);
      const categoryMap = new Map();
      for (const catName of categoryNames) {
        let cat = await Category.findOne({ name: catName, type: 'product' });
        if (!cat) {
          const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          cat = await Category.create({ name: catName, slug, type: 'product' });
        }
        categoryMap.set(catName, cat._id);
      }

      console.log("Categories synced. Processing products...");
      
      let imported = 0;
      let skipped = 0;

      for (const row of results) {
        // Skip variation rows, we only import parent variable products and simple products
        if (row.Type === 'variation') {
          skipped++;
          continue;
        }

        const name = row.Name;
        if (!name) continue;

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        // Find existing product by SKU or slug
        const existing = await Product.findOne({
          $or: [
             { sku: row.SKU || 'MISSING' },
             { slug: slug }
          ]
        });

        if (existing) {
          skipped++;
          continue;
        }

        const images = row.Images ? row.Images.split(',').map(s => s.trim()).filter(Boolean) : [];
        const mainImage = images.length > 0 ? images[0] : '';
        
        const price = parseFloat(row['Sale price'] || row['Regular price'] || '0');
        const compareAtPrice = parseFloat(row['Regular price'] || '0');

        const productCategories = [];
        if (row.Categories) {
          row.Categories.split(',').forEach(c => {
            const trimmed = c.split('>').pop().trim();
            if (categoryMap.has(trimmed)) {
              productCategories.push(categoryMap.get(trimmed));
            }
          });
        }

        const attributes = [];
        for (let i = 1; i <= 10; i++) {
          const attrName = row[`Attribute ${i} name`];
          const attrValues = row[`Attribute ${i} value(s)`];
          if (attrName && attrValues) {
             const type = attrName.toLowerCase().includes('color') ? 'color' : attrName.toLowerCase().includes('size') ? 'size' : 'custom';
             attributes.push({
                name: attrName,
                type: type,
                values: attrValues.split(',').map(v => ({
                   label: v.trim(),
                   value: v.trim(),
                   hex: '',
                   image: ''
                }))
             });
          }
        }

        const newProduct = {
          name,
          slug,
          shortDescription: row['Short description'] || '',
          description: row.Description || '',
          price,
          compareAtPrice,
          sku: row.SKU || '',
          stock: row.Stock ? parseInt(row.Stock) : 0,
          manageStock: row['Manage stock?'] === '1' || row['In stock?'] === '1',
          status: row.Published === '1' ? 'Published' : 'Draft',
          image: mainImage,
          images: images,
          categories: productCategories,
          attributes: attributes,
          tenantId: 'DEFAULT_STORE',
          isDeleted: false
        };

        try {
          await Product.create(newProduct);
          imported++;
        } catch (e) {
          console.error(`Failed to import ${name}:`, e.message);
        }
      }

      console.log(`Import complete! Successfully imported ${imported} products. Skipped ${skipped} products (already existed or variations).`);
      process.exit(0);
    });
}

importProducts().catch(err => {
  console.error("Critical error:", err);
  process.exit(1);
});
