const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURATION ---
const ADMIN_PASSWORD = "1234"; // CHANGE THIS to your secret password
app.use(express.static("public"));

const mongoURI = process.env.MONGO_URL;
mongoose.connect(mongoURI).then(() => console.log("DB Connected")).catch(err => console.log(err));

// --- SCHEMAS ---
const Message = mongoose.model("Message", {
    user: String, text: String, color: String, time: String, room: String, role: String
});

const Role = mongoose.model("Role", {
    name: String, color: String
});

// --- LOGIC ---
io.on("connection", (socket) => {
    
    // 1. SECURE LOGIN: Server decides the role
    socket.on("attempt login", (details) => {
        let assignedRole = "Member";
        let assignedColor = "#ffffff";

        if (details.password === ADMIN_PASSWORD) {
            assignedRole = "Admin";
            assignedColor = "#ed4245"; // Admin Red
        }

        // Send the "Official" session back to the user
        socket.emit("login verified", { 
            user: details.user, 
            role: assignedRole, 
            color: assignedColor 
        });
    });

    socket.on("join room", async (room) => {
        socket.join(room);
        const history = await Message.find({ room: room }).sort({ _id: 1 }).limit(50);
        const roles = await Role.find();
        socket.emit("load history", history, roles);
    });

    // 2. MODERATION: Only let the server handle deletions
    socket.on("delete message", async (msgId) => {
        // Here, the server deletes it from MongoDB
        await Message.findByIdAndDelete(msgId);
        // Tell everyone to remove it from their screens
        io.emit("message deleted", msgId);
    });

    socket.on("create role", async (roleData) => {
        const newRole = new Role(roleData);
        await newRole.save();
        io.emit("role created", roleData);
    });

    socket.on("chat message", async (data) => {
        data.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newMessage = new Message(data);
        const savedMsg = await newMessage.save();
        
        // Include the MongoDB ID so we can delete it later
        const msgToSend = { ...data, _id: savedMsg._id, time: data.time };
        io.to(data.room).emit("chat message", msgToSend);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on ${PORT}`));