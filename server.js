const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const path = require('path'); // Added for Vercel paths

const app = express();
const server = http.createServer(app);

// Vercel needs "polling" to be the first transport for Socket.io
const io = new Server(server, {
    cors: { origin: "*" },
    transports: ['polling', 'websocket'] 
});

// --- CONFIGURATION ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "placeholder";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "placeholder";
const MONGO_URL = process.env.MONGO_URL;
const CALLBACK_URL = process.env.CALLBACK_URL || "/auth/google/callback";

// --- MIDDLEWARE ---
app.use(session({ 
    secret: 'discord_clone_secret', 
    resave: false, 
    saveUninitialized: false 
}));
app.use(passport.initialize());
app.use(passport.session());

// FIX: Explicitly serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE ---
if (MONGO_URL) {
    mongoose.connect(MONGO_URL)
        .then(() => console.log("MongoDB Connected"))
        .catch(err => console.error("DB Error:", err));
}

const Message = mongoose.model("Message", {
    user: String, text: String, color: String, time: String, room: String, role: String
});

// --- ROUTES ---

// FIX: Manual route for the homepage to prevent "Cannot GET /"
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => res.redirect('/')
);

app.get('/api/current_user', (req, res) => {
    res.send(req.user || {});
});

// --- SOCKET LOGIC ---
io.on("connection", (socket) => {
    socket.on("join room", async (room) => {
        socket.join(room);
        try {
            const history = await Message.find({ room }).sort({ _id: 1 }).limit(50);
            socket.emit("load history", history);
        } catch (e) { console.log("Error loading history"); }
    });

    socket.on("chat message", async (data) => {
        data.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newMessage = new Message(data);
        await newMessage.save();
        io.to(data.room).emit("chat message", data);
    });
});

// Export for Vercel
module.exports = server;

// Port listening (Vercel handles this, but we keep it for local testing)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
