import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");
  const users = await User.find({});
  console.log("Registered users:");
  users.forEach((u) => {
    console.log(`- Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, Teams: ${u.teams}`);
  });
  await mongoose.disconnect();
}

run().catch(console.error);
