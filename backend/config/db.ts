import mongoose from 'mongoose';
import 'dotenv/config'; 

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || '');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error('❌ MongoDB Error:', error.message);
    console.error(error);
    process.exit(1);
  }
};