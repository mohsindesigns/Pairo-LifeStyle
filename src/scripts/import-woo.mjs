import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import https from 'https';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

import dbConnect from '../lib/db.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

const CSV_FILE_PATH = 'wc-product-export-2-6-2026-1780399951676.csv';
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'products');
const TENANT_ID = 'root';

// Utility to create slug
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Download image utility
function downloadImage(url) {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string') return resolve(null);
    url = url.trim();
    if (!url.startsWith('http')) return resolve(null);

    const fileName = path.basename(new URL(url).pathname);
    // Add timestamp to prevent overwriting
    const uniqueFileName = `${Date.now()}-${fileName}`;
    const dest = path.join(UPLOADS_DIR, uniqueFileName);

    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(`/uploads/products/${uniqueFileName}`));
        });
      } else {
        file.close();
        fs.unlink(dest, () => resolve(null));
      }
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => resolve(null));
    });
  });
}

async function run() {
  console.log('Connecting to MongoDB...');
  await dbConnect();
  console.log('Connected.');

  console.log('Wiping existing Products...');
  await Product.deleteMany({ tenantId: TENANT_ID });
  
  const results = [];
  console.log(`Parsing CSV: ${CSV_FILE_PATH}`);

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });

  console.log(`Parsed ${results.length} rows.`);

  // Pass 1: Extract and create categories
  console.log('Processing Categories...');
  const categoryMap = new Map(); // name -> ObjectId
  
  for (const row of results) {
    if (!row.Categories) continue;
    const catStrs = row.Categories.split(',').map(c => c.trim()).filter(Boolean);
    for (const catStr of catStrs) {
      // Woo formats categories like: "Jacket > Shearling Bomber Jacket"
      const hierarchy = catStr.split('>').map(c => c.trim());
      const leafCat = hierarchy[hierarchy.length - 1]; // Use deepest category for now
      
      if (!categoryMap.has(leafCat)) {
        const slug = slugify(leafCat);
        let category = await Category.findOne({ slug, type: 'product' });
        if (!category) {
          category = await Category.create({
            name: leafCat,
            slug: slug,
            type: 'product',
            status: 'Published'
          });
        }
        categoryMap.set(leafCat, category._id);
      }
    }
  }

  // Pass 2: Organize Parents and Variations
  const productsMap = new Map(); // SKU or Name -> Product Data
  const variationsMap = new Map(); // Parent SKU -> [Variation Data]

  console.log('Organizing Parents and Variations...');
  for (const row of results) {
    const type = row['Type'] ? row['Type'].toLowerCase() : '';
    if (type === 'variation') {
      const parentSku = row['Parent'];
      if (!variationsMap.has(parentSku)) {
        variationsMap.set(parentSku, []);
      }
      variationsMap.get(parentSku).push(row);
    } else {
      // Simple or Variable parent
      const key = row['SKU'] || row['Name'];
      if (key) {
        productsMap.set(key, row);
      }
    }
  }

  console.log(`Found ${productsMap.size} parent/simple products and ${variationsMap.size} products with variations.`);

  // Pass 3: Process and Insert Products
  let count = 0;
  for (const [key, parentRow] of productsMap.entries()) {
    count++;
    console.log(`Processing product ${count}/${productsMap.size}: ${parentRow['Name']}`);
    
    // Process Images
    const imageUrls = parentRow['Images'] ? parentRow['Images'].split(',').map(i => i.trim()).filter(Boolean) : [];
    const downloadedImages = [];
    for (let i = 0; i < imageUrls.length; i++) {
      process.stdout.write(`  Downloading image ${i+1}/${imageUrls.length}... `);
      const localPath = await downloadImage(imageUrls[i]);
      if (localPath) {
        downloadedImages.push(localPath);
        process.stdout.write(`Success.\n`);
      } else {
        process.stdout.write(`Failed.\n`);
      }
    }

    // Process Categories
    const productCategoryIds = [];
    if (parentRow['Categories']) {
      const catStrs = parentRow['Categories'].split(',').map(c => c.trim()).filter(Boolean);
      for (const catStr of catStrs) {
        const hierarchy = catStr.split('>').map(c => c.trim());
        const leafCat = hierarchy[hierarchy.length - 1];
        if (categoryMap.has(leafCat)) {
          productCategoryIds.push(categoryMap.get(leafCat));
        }
      }
    }

    // Prepare Attributes schema
    const attributes = [];
    const addAttribute = (name, valStr, globalIndex) => {
      if (!name || !valStr) return;
      const values = valStr.split(',').map(v => v.trim()).filter(Boolean).map(v => ({
        label: v,
        value: v
      }));
      attributes.push({
        name: name,
        type: name.toLowerCase() === 'color' ? 'color' : (name.toLowerCase() === 'size' ? 'size' : 'custom'),
        values: values
      });
    };

    // Woo has Attribute 1 name, Attribute 1 value(s), Attribute 2 name, etc.
    for (let i = 1; i <= 5; i++) {
      if (parentRow[`Attribute ${i} name`]) {
        addAttribute(parentRow[`Attribute ${i} name`], parentRow[`Attribute ${i} value(s)`], i);
      }
    }

    // Prepare Variations
    const variantCombinations = [];
    const parentSku = parentRow['SKU'];
    if (parentSku && variationsMap.has(parentSku)) {
      const variationRows = variationsMap.get(parentSku);
      for (const vRow of variationRows) {
        // Build title e.g. "Black / M"
        const vTitleParts = [];
        for (let i = 1; i <= 5; i++) {
          if (vRow[`Attribute ${i} value(s)`]) {
            vTitleParts.push(vRow[`Attribute ${i} value(s)`].trim());
          }
        }
        
        variantCombinations.push({
          title: vTitleParts.join(' / ') || vRow['Name'].replace(parentRow['Name'] + ' - ', ''),
          sku: vRow['SKU'] || `${parentSku}-${vTitleParts.join('-')}`,
          price: parseFloat(vRow['Regular price'] || vRow['Sale price'] || parentRow['Regular price'] || 0),
          stock: parseInt(vRow['Stock'] || 0, 10),
          image: downloadedImages[0] || '' // Fallback to first parent image
        });
      }
    }

    // Build Product Document
    const name = parentRow['Name'] || 'Unnamed Product';
    const slug = slugify(name) + '-' + Math.random().toString(36).substring(2, 6);
    const productDoc = {
      tenantId: TENANT_ID,
      name: name,
      slug: slug,
      shortDescription: parentRow['Short description'] || '',
      description: parentRow['Description'] || '',
      status: parseInt(parentRow['Published']) === 1 ? 'Published' : 'Draft',
      isFeatured: parseInt(parentRow['Is featured?']) === 1,
      price: parseFloat(parentRow['Regular price'] || parentRow['Sale price'] || 0),
      compareAtPrice: parentRow['Sale price'] ? parseFloat(parentRow['Regular price']) : null,
      sku: parentRow['SKU'] || slug,
      stock: parseInt(parentRow['Stock'] || 0, 10),
      images: downloadedImages,
      categories: productCategoryIds,
      attributes: attributes,
      variantCombinations: variantCombinations,
      productType: variantCombinations.length > 0 ? 'variable' : 'simple',
      tags: parentRow['Tags'] ? parentRow['Tags'].split(',').map(t => t.trim()) : []
    };

    try {
      await Product.create(productDoc);
      console.log(`  -> Created ${name}`);
    } catch (err) {
      console.error(`  -> Error creating ${name}:`, err.message);
    }
  }

  console.log('Migration Complete!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
