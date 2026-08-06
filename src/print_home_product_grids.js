const mongoose = require('/var/www/pairolifestyle.com/node_modules/mongoose');

async function run() {
  const uri = "mongodb://pairolifestyle_user:mD%26tEam%2FpLs-19yY@127.0.0.1:27017/pairo?authSource=pairo&replicaSet=rs0";
  await mongoose.connect(uri);
  const home = await mongoose.connection.db.collection('pages').findOne({ slug: 'home', tenantId: 'DEFAULT_STORE' });
  console.log("HOMEPAGE PRODUCT GRID SECTIONS CONFIGS:");
  if (home && home.sections) {
    home.sections.forEach(s => {
      if (s.type === 'product_grid') {
        console.log(`- Section ID: ${s.id}, Title: ${s.config?.title}, config:`, JSON.stringify(s.config, null, 2));
      }
    });
  }
  await mongoose.disconnect();
}
run().catch(console.error);
