const mongoose = require('/var/www/pairolifestyle.com/node_modules/mongoose');

async function main() {
  const uri = 'mongodb://pairolifestyle_user:mD%26tEam%2FpLs-19yY@127.0.0.1:27017/pairo?authSource=pairo&replicaSet=rs0';
  
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    // 1. Query the categories collection
    const categories = await db.collection('categories').find({
      $or: [
        { name: { $regex: /^men$|^women$/i } },
        { slug: { $regex: /^men$|^women$/i } }
      ]
    }).toArray();

    console.log('\n--- MATCHING CATEGORIES FOUND IN DB ---');
    if (categories.length === 0) {
      console.log('No categories found matching "men" or "women".');
    } else {
      categories.forEach(cat => {
        console.log(JSON.stringify(cat, null, 2));
      });
    }

    // 2. Query products for category match
    const products = await db.collection('products').find({
      $or: [
        { category: { $regex: /^men$|^women$/i } },
        { slug: { $regex: /^men$|^women$/i } }
      ]
    }).toArray();

    console.log('\n--- MATCHING PRODUCTS FOUND IN DB (with direct category string or slug) ---');
    if (products.length === 0) {
      console.log('No products found matching "men" or "women".');
    } else {
      products.forEach(p => {
        console.log(` - Product Name: "${p.name}" (Slug: "${p.slug}", Direct Category field: "${p.category}", ID: ${p._id})`);
      });
    }

    // 3. Count total categories in DB
    const totalCats = await db.collection('categories').countDocuments({});
    console.log(`\nTotal Categories in DB: ${totalCats}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
