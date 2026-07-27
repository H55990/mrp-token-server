// server.js — MathsRéussitePro / serveur de jetons LiveKit
const express = require('express');
const cors = require('cors');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

const app = express();
app.use(cors());
app.use(express.json());

const {
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
  TEACHER_ACCESS_CODE = 'zriouil2026',
  PORT = 8080,
} = process.env;

if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.warn('LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET غير معرفين');
}

const roomService = new RoomServiceClient(LIVEKIT_URL?.replace('wss://', 'https://').replace('ws://', 'http://'), LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

const rooms = new Map();

function genRoomCode() {
  const n = Math.floor(1000 + Math.random() * 8999);
  return 'MRP-' + n;
}
function genRoomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function buildToken(roomName, identity, name, role) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name,
    metadata: JSON.stringify({ role }),
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return await at.toJwt();
}

app.post('/api/teacher/create-room', async (req, res) => {
  const { accessCode, profName } = req.body || {};
  if (!accessCode || accessCode.toLowerCase() !== TEACHER_ACCESS_CODE.toLowerCase()) {
    return res.status(403).json({ error: 'invalid_access_code' });
  }
  const roomName = genRoomCode();
  const roomPassword = genRoomPassword();
  rooms.set(roomName, { password: roomPassword, createdAt: Date.now() });

  try {
    const token = await buildToken(roomName, 'prof-' + roomName, profName || 'Professeur', 'prof');
    res.json({ roomName, roomPassword, token, livekitUrl: LIVEKIT_URL });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'token_generation_failed' });
  }
});

app.post('/api/student/join-room', async (req, res) => {
  const { roomName, roomPassword, studentName } = req.body || {};
  const room = rooms.get((roomName || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'room_not_found' });
  if (room.password !== roomPassword) return res.status(403).json({ error: 'wrong_password' });
  if (!studentName) return res.status(400).json({ error: 'missing_name' });

  try {
    const identity = 'student-' + studentName + '-' + Math.floor(Math.random() * 10000);
    const token = await buildToken(roomName.toUpperCase(), identity, studentName, 'student');
    res.json({ token, livekitUrl: LIVEKIT_URL });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'token_generation_failed' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Token server المرسي على المنفذ ${PORT}`));
