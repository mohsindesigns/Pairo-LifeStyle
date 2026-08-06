const mongoose = require('/var/www/pairolifestyle.com/node_modules/mongoose');

async function run() {
  const uri = "mongodb://pairolifestyle_user:mD%26tEam%2FpLs-19yY@127.0.0.1:27017/pairo?authSource=pairo&replicaSet=rs0";
  await mongoose.connect(uri);
  const config = await mongoose.connection.db.collection('siteconfigs').findOne({ key: 'main' });
  console.log("CURRENT SITE CONFIG:");
  console.log(JSON.stringify(config, null, 2));
  await mongoose.disconnect();
}
run().catch(console.error);
