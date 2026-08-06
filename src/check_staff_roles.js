const mongoose = require('/var/www/pairolifestyle.com/node_modules/mongoose');

async function run() {
  const uri = "mongodb://pairolifestyle_user:mD%26tEam%2FpLs-19yY@127.0.0.1:27017/pairo?authSource=pairo&replicaSet=rs0";
  await mongoose.connect(uri);
  const staff = await mongoose.connection.db.collection('staffs').find({}).toArray();
  console.log("STAFF MEMBERS AND ROLES:");
  staff.forEach(s => {
    console.log(`- email: ${s.email}, role: ${s.role}`);
  });
  await mongoose.disconnect();
}
run().catch(console.error);
