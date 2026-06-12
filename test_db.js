import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mongoose from 'mongoose';

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection;
    const catCollection = db.collection('categories');
    const categories = await catCollection.find({}).toArray();
    console.log("DB CATEGORIES SLUGS:", categories.map(c => c.slug));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
