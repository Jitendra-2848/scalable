import { config } from "dotenv";
config({ path: "./.env" });
import MESSAGE_API from "./routes/message.js";
import pool from "./config/db.js";
import Auth_API from "./routes/auth.js";
import cors from "cors";
import cookie_parser from "cookie-parser";
import User_API from "./routes/User.js";
import {server,app,express} from "./utils/socket.js"
import "./data/worker.js";

app.use(express.json());
app.use(cookie_parser());
app.use(
  cors({
    origin: process.env.VITE_FRONTEND_URL,
    credentials: true,
  })
);

app.use("/message", MESSAGE_API);
app.use("/auth", Auth_API);
app.use("/user", User_API);

app.get("/", async (req, res) => {
  const result = await pool.query("SELECT * from messages");
  return res
    .status(200)
    .json(`The database name is : ${result.rows.length}`);
});

const PORT = process.env.PORT || 8000;

const startServer = () => {
  server.listen(PORT, () => {
    console.log(`listening on PORT : ${PORT}`);
  });
};

startServer();