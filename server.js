const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const mongoURI = process.env.MONGO_URL;
mongoose.connect(mongoURI).then(() => console.log("Connected to MongoDB!")).catch(err => console.log("DB Error:", err));

// --- MODELS ---
const Message = mongoose.model("Message", {
    user: String,
    text: String,
    color: String,
    time: String,
    room: String,
    role: String
});

const Role = mongoose.model("Role", {
    name: String,
    color: String
});

// --- SERVER LOGIC ---
io.on("connection", async (socket) => {
    console.log("User connected");

    socket.on("join room", async (roomName) => {
        socket.join(roomName);
        
        try {
            // 1. Get messages for this room
            const history = await Message.find({ room: roomName }).sort({ _id: 1 }).limit(50);
            // 2. Get all custom roles created so far
            const roles = await Role.find();
            
            // Send both back to the user
            socket.emit("load history", history, roles);
        } catch (err) {
            console.log("Error joining room:", err);
        }
    });

    // Admin creates a new role
    socket.on("create role", async (roleData) => {
        const newRole = new Role(roleData);
        await newRole.save();
        // Send to EVERYONE so their dropdowns update immediately
        io.emit("role created", roleData); 
    });

    socket.on("chat message", async (data) => {
        data.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const newMessage = new Message(data);
        await newMessage.save();
        
        io.to(data.room).emit("chat message", data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Pro Server running on port ${PORT}`));