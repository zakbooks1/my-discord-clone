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

// --- GOOGLE & SESSION CONFIG ---
// Replace these with your codes from Google Cloud Console
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234";

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
mongoose.connect(mongoURI).then(() => console.log("DB Connected")).catch(err => console.log(err));

const Message = mongoose.model("Message", {
    user: String, text: String, color: String, time: String, room: String, role: String
});

const Role = mongoose.model("Role", { name: String, color: String });

// --- PASSPORT GOOGLE STRATEGY ---
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  (accessToken, refreshToken, profile, done) => {
    // profile contains the Google User info (Name, Email, Photo)
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// --- AUTH ROUTES ---
// 1. Redirect to Google
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2. Google sends user back here
app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // Success! Redirect to chat. The user info is now in req.user
        res.redirect('/');
    }
);

// 3. API to check if user is logged in
app.get('/api/current_user', (req, res) => {
    res.send(req.user);
});

// --- CHAT LOGIC ---
io.on("connection", (socket) => {
    
    socket.on("attempt login", (details) => {
        let assignedRole = "Member";
        let assignedColor = "#ffffff";
        if (details.password === ADMIN_PASSWORD) {
            assignedRole = "Admin";
            assignedColor = "#ed4245";
        }
        socket.emit("login verified", { user: details.user, role: assignedRole, color: assignedColor });
    });

    socket.on("join room", async (room) => {
        socket.join(room);
        const history = await Message.find({ room }).sort({ _id: 1 }).limit(50);
        const roles = await Role.find();
        socket.emit("load history", history, roles);
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
server.listen(PORT, () => console.log(`Server running on ${PORT}`));