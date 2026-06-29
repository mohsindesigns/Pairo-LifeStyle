const mongoose = require('/var/www/pairolifestyle.com/node_modules/mongoose');

async function main() {
  const uri = 'mongodb://pairolifestyle_user:mD%26tEam%2FpLs-19yY@127.0.0.1:27017/pairo?authSource=pairo&replicaSet=rs0';
  
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    console.log('\n--- CATEGORIES INDEXES ---');
    const catIndexes = await db.collection('categories').indexes();
    console.log(JSON.stringify(catIndexes, null, 2));

    console.log('\n--- PRODUCTS INDEXES ---');
    const prodIndexes = await db.collection('products').indexes();
    console.log(JSON.stringify(prodIndexes, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
