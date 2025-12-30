const path = require('path');
const express = require('express');
const http = require('http');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const { Server } = require('socket.io');

const db = require('./db');

const app = express();
const cors = require('cors');
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: 'http://localhost:5173', credentials: true } });

app.use(express.json());

// Allow frontend origin and include credentials (cookies)
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));

const sessionMiddleware = session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: __dirname }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
});

app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy((username, password, done) => {
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return done(err);
    if (!user) return done(null, false, { message: 'Incorrect username.' });
    bcrypt.compare(password, user.password_hash).then(match => {
      if (!match) return done(null, false, { message: 'Incorrect password.' });
      return done(null, { id: user.id, username: user.username, is_admin: !!user.is_admin });
    }).catch(done);
  });
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  db.get('SELECT id, username, is_admin FROM users WHERE id = ?', [id], (err, user) => {
    if (err) return done(err);
    if (!user) return done(null, false);
    done(null, { id: user.id, username: user.username, is_admin: !!user.is_admin });
  });
});

function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'unauthenticated' });
}

// Auth endpoints
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  const password_hash = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, password_hash], function (err) {
    if (err) return res.status(400).json({ error: 'Username may be taken' });
    res.json({ id: this.lastID, username });
  });
});

app.post('/api/login', (req, res, next) => {
  passport.authenticate('local', (err, user) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    req.logIn(user, (err) => {
      if (err) return next(err);
      res.json({ id: user.id, username: user.username, is_admin: user.is_admin });
    });
  })(req, res, next);
});

app.post('/api/logout', (req, res) => {
  req.logout(() => {});
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.isAuthenticated()) return res.json({ user: null });
  res.json({ user: { id: req.user.id, username: req.user.username, is_admin: req.user.is_admin } });
});

// Rooms API
app.get('/api/rooms', (req, res) => {
  db.all('SELECT id, name, owner_id, created_at FROM rooms', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db' });
    res.json({ rooms: rows });
  });
});

app.post('/api/rooms', ensureAuth, (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 100);
  if (!name) return res.status(400).json({ error: 'Invalid name' });
  db.run('INSERT INTO rooms (name, owner_id) VALUES (?, ?)', [name, req.user.id], function (err) {
    if (err) return res.status(400).json({ error: 'Room may exist' });
    const room = { id: this.lastID, name, owner_id: req.user.id };
    io.emit('room_created', room);
    res.json({ room });
  });
});

// Serve frontend build if present
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// Wire up socket.io to use the same session and passport
io.use((socket, next) => {
  const req = socket.request;
  sessionMiddleware(req, {}, () => {
    passport.initialize()(req, {}, () => {
      passport.session()(req, {}, () => {
        if (req.user) socket.user = req.user;
        next();
      });
    });
  });
});

const rooms = new Map(); // roomId -> { members: Set(socket.id), admins: Set(userId) }

io.on('connection', (socket) => {
  const user = socket.user || { id: null, username: 'guest' };

  socket.joinedRooms = new Set();
  socket.on('join_room', (roomId, cb) => {
    db.get('SELECT * FROM rooms WHERE id = ?', [roomId], (err, row) => {
      if (err || !row) return cb && cb({ error: 'no_room' });
      if (socket.joinedRooms.has(roomId)) return cb && cb({ ok: true, already: true });
      socket.join(`room_${roomId}`);
      let r = rooms.get(roomId);
      if (!r) {
        r = { members: new Set(), admins: new Set([row.owner_id]) };
        rooms.set(roomId, r);
      }
      r.members.add(socket.id);
      socket.joinedRooms.add(roomId);
      io.to(`room_${roomId}`).emit('user_joined', { user: { id: user.id, username: user.username } });
      cb && cb({ ok: true });
    });
  });

  socket.on('leave_room', (roomId, cb) => {
    if (!socket.joinedRooms.has(roomId)) return cb && cb({ ok: true, already: false });
    socket.leave(`room_${roomId}`);
    const r = rooms.get(roomId);
    if (r) r.members.delete(socket.id);
    socket.joinedRooms.delete(roomId);
    io.to(`room_${roomId}`).emit('user_left', { user: { id: user.id, username: user.username } });
    cb && cb({ ok: true });
  });

  socket.on('msg', (payload) => {
    // payload: { roomId, text }
    const roomId = payload && payload.roomId;
    const text = payload && payload.text;
    if (!roomId || !socket.joinedRooms.has(roomId)) return;
    const outgoing = { roomId, user: { id: user.id, username: user.username }, text, time: Date.now() };
    io.to(`room_${roomId}`).emit('msg', outgoing);
  });

  socket.on('kick', (roomId, targetUserId, cb) => {
    if (!roomId) return cb && cb({ error: 'missing_room' });
    const r = rooms.get(roomId);
    if (!r) return cb && cb({ error: 'no_room_state' });
    const isAdmin = r.admins.has(user.id) || user.is_admin;
    if (!isAdmin) return cb && cb({ error: 'not_admin' });
    // find socket(s) for target user id and remove from room
    for (const [id, s] of io.of('/').sockets) {
      if (s.user && s.user.id === targetUserId && s.joinedRooms && s.joinedRooms.has(roomId)) {
        s.leave(`room_${roomId}`);
        r.members.delete(s.id);
        if (s.joinedRooms) s.joinedRooms.delete(roomId);
        s.emit('kicked', { roomId });
      }
    }
    io.to(`room_${roomId}`).emit('user_kicked', { userId: targetUserId });
    cb && cb({ ok: true });
  });

  socket.on('disconnect', () => {
    const roomId = socket.currentRoom;
    if (roomId) {
      const r = rooms.get(roomId);
      if (r) r.members.delete(socket.id);
      io.to(`room_${roomId}`).emit('user_left', { user: { id: user.id, username: user.username } });
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
