import mongoose from "mongoose";

mongoose.connect(process.env.MONGODB_URL).catch((err) => {
  console.error('Database initial connection failed:', {
    name: err?.name,
    code: err?.code,
  });
})

const db = mongoose.connection
db.on('connected', () => {
  console.log('Database connected successfully');
})
db.on('error', (error) => {
  console.error('Database connection error:', {
    name: error?.name,
    code: error?.code,
  });
})
db.on('disconnected', () => {
  console.log('Database disconnected');
})
export default db;
