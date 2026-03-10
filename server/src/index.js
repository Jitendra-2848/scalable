import { config } from "dotenv";
import path from "path";
config({ path: "./.env" })
import express from "express";
import http from "http"
import MESSAGE_API from "./routes/message.js";
import pool from "./config/db.js"
import { Server } from "socket.io"
import Auth_API from "./routes/auth.js";
import cors from "cors"
import cookie_parser from "cookie-parser"
import User_API from "./routes/User.js";
const app = express();
const server = http.createServer(app);
app.use(express.json())
app.use(cookie_parser())
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}))
app.use("/message", MESSAGE_API);
app.use("/auth", Auth_API);
app.use("/user", User_API);

app.get("/", async (req, res) => {
    // res.write("Hello from server");
    // res.end();
    const result = await pool.query("SELECT current_database()")
    return res.status(200).json(`The database name is : ${result.rows[0].current_database}`);
})

app.get("/x", async (req, res) => {
    console.log("hello")
    const result = await pool.query("select * from chat");
    console.log(result.rows)
    return res.status(200).json(result.rows)
})

const io = new Server(server, {
    cors: { origin: "*" }
})
let room = new Map();
io.on("connection", (socket) => {
    socket.on("join", (id) => {
        room.set(id, socket.id);
        socket.emit("onlineUsers",Array.from(room.keys()));
        socket.broadcast.emit("onlineUsers",Array.from(room.keys()));
        socket.user_id = id;
        console.log(room);
    })
    socket.on("message", (message) => {
        console.log(message);
        const receiverSocket = room.get(message.id);
        if (receiverSocket) {
            io.to(receiverSocket).emit("onMessage", message);
        }
    })
    socket.on("typing",(id)=>{
        console.log(id);
        const receiverSocket = room.get(id);
        console.log(id);
        console.log(receiverSocket);
        if (receiverSocket) {
            io.to(receiverSocket).emit("Typing",socket.user_id);
        }
    })
    socket.on("disconnect", () => {
        if (socket.user_id) room.delete(socket.user_id)
        socket.broadcast.emit("onlineUsers",Array.from(room.keys()));
    })
})


console.log(process.env.PORT)
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`listening on PORT : ${PORT}`);
})