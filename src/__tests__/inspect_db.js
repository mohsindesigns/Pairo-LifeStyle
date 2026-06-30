const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/pairo');
  
  const Engine = (await import('../lib/promotionEngine/Engine.js')).default;
  
  const cart = {
    subtotal: 100,
    items: [
      { productId: new mongoose.Types.ObjectId(), name: "Sample Item", price: 100, quantity: 1 }
    ]
  };
  
  const results = await Engine.evaluate(cart, { tenantId: 'default' });
  console.log('ENGINE EVALUATE RESULTS (no coupon):', JSON.stringify(results, null, 2));
  
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
