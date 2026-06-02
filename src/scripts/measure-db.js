const mongoose = require('mongoose');
require('dotenv').config({path:'.env.local'});
const uri = process.env.MONGODB_URI.trim().replace(/^["'](.+)["']$/, '$1');

async function test() {
  const startConnect = Date.now();
  await mongoose.connect(uri, { maxPoolSize: 1 });
  console.log('Connect took:', Date.now() - startConnect, 'ms');
  
  const startQuery = Date.now();
  const res = await mongoose.connection.db.collection('products').find({ status: 'Published' }).sort({ createdAt: -1 }).limit(8).toArray();
  console.log('Query took:', Date.now() - startQuery, 'ms', res.length, 'docs');
  
  process.exit(0);
}

test().catch(console.error);
