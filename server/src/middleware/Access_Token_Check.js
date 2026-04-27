import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const verify = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: "Unauthorized person!!" });
        }
        const token = authHeader.split(" ")[1];
        const decoded_jwt = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = { id: decoded_jwt.id }; 
        req.user.id = decoded_jwt.id;
        next();
    } catch (error) {
        console.log(error.message);
        return res.status(401).json({ message: "Invalid or expired token!" });
    }
};

export {
    verify
};