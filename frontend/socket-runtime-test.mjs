import { io } from "socket.io-client";

const base = "http://localhost:5000/api";
const socketUrl = "http://localhost:5000";

function waitForEvent(socket, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);

    const handler = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };

    socket.once(event, handler);
  });
}

async function post(path, body, token) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`${path} failed: ${JSON.stringify(json)}`);
  return json;
}

async function run() {
  const suffix = Date.now();

  const hostSignup = await post("/auth/signup", {
    name: "Socket Host",
    email: `sockhost${suffix}@test.com`,
    password: "secret123",
  });

  const guestSignup = await post("/auth/signup", {
    name: "Socket Guest",
    email: `sockguest${suffix}@test.com`,
    password: "secret123",
  });

  const meetingCreate = await post(
    "/meetings/create",
    {
      title: "Socket Runtime Test",
      description: "e2e test",
      scheduledTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      participantIds: [guestSignup.user._id],
      status: "scheduled",
    },
    hostSignup.token
  );

  const meetingId = meetingCreate.meeting._id;

  const host = io(socketUrl, {
    auth: { token: hostSignup.token },
    transports: ["websocket", "polling"],
    timeout: 10000,
  });

  const guest = io(socketUrl, {
    auth: { token: guestSignup.token },
    transports: ["websocket", "polling"],
    timeout: 10000,
  });

  await Promise.all([
    new Promise((resolve, reject) => {
      host.once("connect", resolve);
      host.once("connect_error", reject);
    }),
    new Promise((resolve, reject) => {
      guest.once("connect", resolve);
      guest.once("connect_error", reject);
    }),
  ]);

  const hostRoomParticipantsPromise = waitForEvent(host, "room-participants");
  const guestRoomParticipantsPromise = waitForEvent(guest, "room-participants");

  const hostJoinAck = await new Promise((resolve) =>
    host.emit("join-room", { meetingId }, (ack) => resolve(ack))
  );
  if (hostJoinAck?.error) throw new Error(`host join error: ${hostJoinAck.error}`);

  const guestJoinAck = await new Promise((resolve) =>
    guest.emit("join-room", { meetingId }, (ack) => resolve(ack))
  );
  if (guestJoinAck?.error) throw new Error(`guest join error: ${guestJoinAck.error}`);

  await Promise.all([hostRoomParticipantsPromise, guestRoomParticipantsPromise]);

  const messagePromise = waitForEvent(guest, "receive-message");
  host.emit("send-message", { meetingId, content: "hello realtime", type: "text" }, () => {});
  const receivedMsg = await messagePromise;
  if (!receivedMsg?.text?.includes("hello realtime")) {
    throw new Error("receive-message payload mismatch");
  }

  const offerPromise = waitForEvent(guest, "offer");
  host.emit("offer", {
    meetingId,
    targetSocketId: guest.id,
    offer: { type: "offer", sdp: "dummy-offer" },
  });
  const offerPayload = await offerPromise;
  if (offerPayload?.from !== host.id) throw new Error("offer sender mismatch");

  const answerPromise = waitForEvent(host, "answer");
  guest.emit("answer", {
    meetingId,
    targetSocketId: host.id,
    answer: { type: "answer", sdp: "dummy-answer" },
  });
  const answerPayload = await answerPromise;
  if (answerPayload?.from !== guest.id) throw new Error("answer sender mismatch");

  const icePromise = waitForEvent(guest, "ice-candidate");
  host.emit("ice-candidate", {
    meetingId,
    targetSocketId: guest.id,
    candidate: { candidate: "dummy-candidate", sdpMid: "0", sdpMLineIndex: 0 },
  });
  const icePayload = await icePromise;
  if (icePayload?.from !== host.id) throw new Error("ice sender mismatch");

  host.emit("leave-room", { meetingId }, () => {});
  guest.emit("leave-room", { meetingId }, () => {});

  host.disconnect();
  guest.disconnect();

  console.log("SOCKET_TEST=PASS");
  console.log(`MEETING_ID=${meetingId}`);
  console.log(`HOST_SOCKET=${host.id}`);
  console.log(`GUEST_SOCKET=${guest.id}`);
}

run().catch((error) => {
  console.error("SOCKET_TEST=FAIL");
  console.error(error);
  process.exit(1);
});
