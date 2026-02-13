const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURATION (Environment Variables) ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234";

// This MUST match what you put in Google Cloud Console exactly
const CALLBACK_URL = "https://my-discord-clone-1.onrender.com/auth/google/callback";

app.use(session({ 
    secret: 'discord_clone_secret', 
    resave: false, 
    saveUninitialized: false 
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static("public"));

// --- DATABASE ---
const mongoURI = process.env.MONGO_URL;
mongoose.connect(mongoURI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.error("DB Error:", err));

const Message = mongoose.model("Message", {
    user: String, text: String, color: String, time: String, room: String, role: String
});

const Role = mongoose.model("Role", { name: String, color: String });

// --- PASSPORT GOOGLE STRATEGY ---
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL
  },
  (accessToken, refreshToken, profile, done) => {
    // VIP List: Automatic Admin for your email
    const myEmail = "zakbooks1@gmail.com"; // Ensure this is your email
    
    if (profile.emails && profile.emails[0].value === myEmail) {
        profile.role = "Admin";
        profile.color = "#ed4245"; 
    } else {
        profile.role = "Member";
        profile.color = "#5865f2";
    }
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// --- ROUTES ---
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
    socket.on("attempt login", (details) => {
        let role = "Member", color = "#ffffff";
        if (details.password === ADMIN_PASSWORD) {
            role = "Admin"; color = "#ed4245";
        }
        socket.emit("login verified", { user: details.user, role: role, color: color });
    });

    socket.on("join room", async (room) => {
        socket.join(room);
        const history = await Message.find({ room }).sort({ _id: 1 }).limit(50);
        socket.emit("load history", history);
    });

    socket.on("chat message", async (data) => {
        data.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newMessage = new Message(data);
        const savedMsg = await newMessage.save();
        io.to(data.room).emit("chat message", { ...data, _id: savedMsg._id });
    });

    socket.on("delete message", async (id) => {
        await Message.findByIdAndDelete(id);
        io.emit("message deleted", id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));