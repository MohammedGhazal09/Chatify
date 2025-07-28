import mongoose from "mongoose";

mongoose.connect(process.env.MONGODB_URL).catch((err) => console.log(err.message))

const db = mongoose.connection
db.on('connected', () => {
  console.log('Database connected successfully');
})
db.on('error', (error) => {
  console.error('Database connection error:', error.message);
})
db.on('disconnected', () => {
  console.log('Database disconnected');
})
export default db;