const mongoose = require('/var/www/pairolifestyle.com/node_modules/mongoose');

async function run() {
  const uri = "mongodb://pairolifestyle_user:mD%26tEam%2FpLs-19yY@127.0.0.1:27017/pairo?authSource=pairo&replicaSet=rs0";
  await mongoose.connect(uri);
  const pages = await mongoose.connection.db.collection('pages').find({}).toArray();
  console.log("ALL PAGES IN DATABASE:");
  pages.forEach(p => {
    console.log(`- ID: ${p._id}, Title: ${p.title}, Slug: ${p.slug}, Template: ${p.template}, Status: ${p.status}, isSystem: ${p.isSystem}`);
  });
  await mongoose.disconnect();
}
run().catch(console.error);
