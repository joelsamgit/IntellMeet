import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";
import Team from "../src/models/Team.js";
import Invitation from "../src/models/Invitation.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  // Fetch users
  const sender = await User.findOne({ email: "joelsambmv@gmail.com" });
  const receiver = await User.findOne({ email: "test@example.com" });

  if (!sender || !receiver) {
    console.error("Please run list-users script first to ensure users exist.");
    await mongoose.disconnect();
    return;
  }

  // Clear previous invitations
  await Invitation.deleteMany({});
  await Team.deleteMany({});

  // 1. Create a team for sender
  const team = await Team.create({
    name: `${sender.name}'s Team`,
    members: [sender._id],
  });
  await User.findByIdAndUpdate(sender._id, { $addToSet: { teams: team._id } });
  console.log(`Created team: ${team.name}`);

  // 2. Invite the receiver
  const invitation = await Invitation.create({
    email: receiver.email,
    invitedBy: sender._id,
    team: team._id,
    status: "pending",
  });
  console.log(`Sent invitation to: ${receiver.email}`);

  // 3. Query invitations for the receiver
  const receiverInvites = await Invitation.find({
    email: receiver.email,
    status: "pending",
  }).populate("invitedBy", "name email").populate("team", "name");

  console.log(`\nPending invites for ${receiver.email}:`);
  receiverInvites.forEach((i) => {
    console.log(`- From: ${i.invitedBy.name} (${i.invitedBy.email}) for Team: "${i.team.name}"`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
