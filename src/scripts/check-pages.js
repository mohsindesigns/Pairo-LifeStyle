const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI.trim().replace(/^["'](.+)["']$/, '$1');

mongoose.connect(MONGODB_URI).then(async () => {
  const pages = await mongoose.connection.db.collection('pages')
    .find({ tenantId: 'DEFAULT_STORE' }, { projection: { slug: 1, title: 1, status: 1, isSystem: 1, template: 1 } })
    .toArray();
  
  console.log('Total pages found:', pages.length);
  pages.forEach(p => {
    console.log(`  - [${p.status || 'no-status'}] ${p.title} (slug: ${p.slug}, isSystem: ${p.isSystem}, template: ${p.template})`);
  });
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
