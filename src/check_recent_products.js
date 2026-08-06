const mongoose = require('/var/www/pairolifestyle.com/node_modules/mongoose');

async function run() {
  const uri = "mongodb://pairolifestyle_user:mD%26tEam%2FpLs-19yY@127.0.0.1:27017/pairo?authSource=pairo&replicaSet=rs0";
  await mongoose.connect(uri);
  const products = await mongoose.connection.db.collection('products')
    .find({ isDeleted: false })
    .sort({ updatedAt: -1 })
    .limit(5)
    .toArray();
  console.log("RECENTLY UPDATED PRODUCTS:");
  products.forEach(p => {
    console.log(`- name: ${p.name}, images:`, p.images);
  });
  await mongoose.disconnect();
}
run().catch(console.error);
