const mongoose = require('/var/www/pairolifestyle.com/node_modules/mongoose');

async function main() {
  const uri = 'mongodb://pairolifestyle_user:mD%26tEam%2FpLs-19yY@127.0.0.1:27017/pairo?authSource=pairo&replicaSet=rs0';
  
  try {
    console.log("Connecting to Mongoose...");
    await mongoose.connect(uri);
    console.log("Connected!");

    const db = mongoose.connection.db;

    // Measure GET /api/products logic time before optimization
    console.log("\n--- BENCHMARKING GET PRODUCTS API LOGIC ---");
    
    console.time("Find products");
    const products = await db.collection('products').find({
      status: 'Published',
      isDeleted: { $ne: true }
    }).toArray();
    console.timeEnd("Find products");

    console.log(`Found ${products.length} products.`);

    const allUrls = [];
    products.forEach(p => {
      if (p.images) allUrls.push(...p.images);
      if (p.image) allUrls.push(p.image);
    });
    const uniqueUrls = [...new Set(allUrls.filter(Boolean))];
    console.log(`Extracted ${uniqueUrls.length} unique image URLs.`);

    // Time getAltTextMap query
    console.time("Query media alt text (no index)");
    const mediaItemsBefore = await db.collection('media').find({
      url: { $in: uniqueUrls },
      isDeleted: false
    }).toArray();
    console.timeEnd("Query media alt text (no index)");

    // Let's create the indexes!
    console.log("\n--- CREATING DATABASE INDEXES FOR PERFORMANCE ---");
    
    console.time("Creating media URL index");
    await db.collection('media').createIndex({ url: 1, isDeleted: 1 });
    console.timeEnd("Creating media URL index");

    console.time("Creating products query index");
    await db.collection('products').createIndex({ status: 1, isDeleted: 1, createdAt: -1 });
    console.timeEnd("Creating products query index");

    // Measure again after indexes are created!
    console.log("\n--- BENCHMARK AFTER INDEXES ---");

    console.time("Find products (with index)");
    const productsAfter = await db.collection('products').find({
      status: 'Published',
      isDeleted: { $ne: true }
    }).sort({ createdAt: -1 }).toArray();
    console.timeEnd("Find products (with index)");

    console.time("Query media alt text (with index)");
    const mediaItemsAfter = await db.collection('media').find({
      url: { $in: uniqueUrls },
      isDeleted: false
    }).toArray();
    console.timeEnd("Query media alt text (with index)");

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
