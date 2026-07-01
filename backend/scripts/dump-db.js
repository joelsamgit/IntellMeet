import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";
import Team from "../src/models/Team.js";
import Invitation from "../src/models/Invitation.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const users = await User.find({});
  console.log("\n--- Users ---");
  users.forEach((u) => {
    console.log(`ID: ${u._id}, Name: ${u.name}, Email: ${u.email}`);
  });

  const teams = await Team.find({});
  console.log("\n--- Teams ---");
  teams.forEach((t) => {
    console.log(`ID: ${t._id}, Name: ${t.name}, Members: ${t.members.join(", ")}`);
  });

  const invites = await Invitation.find({});
  console.log("\n--- Invitations ---");
  invites.forEach((i) => {
    console.log(`ID: ${i._id}, Email: ${i.email}, InvitedBy: ${i.invitedBy}, Team: ${i.team}, Status: ${i.status}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
