import { config } from "dotenv";
import pkg from "pg";
const {Pool} = pkg;
config({path : "./src/.env"})
// console.log({
//     user:process.env.USER,
//     database:process.env.DATABASE,
//     port:process.env.DBPORT,
//     host:process.env.HOST,
//     password:process.env.PASSWORD
// }) 
const pool = new Pool({
    // user: process.env.DB_USER || process.env.USER,
    // database: process.env.DB_NAME || process.env.DATABASE,
    // port: process.env.DB_PORT || process.env.DBPORT,
    // host: process.env.DB_HOST || process.env.HOST,
    // password: process.env.DB_PASSWORD || process.env.PASSWORD
    connectionString: process.env.DATABASE_URL,
    // ✅ Optimized connection pool for high concurrency
    max: 50,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    // Keep-alive for long-running queries
    keepalives: 1,
    keepalives_idle: 30,
});

pool.on("connect",()=>{
    console.log("connection to database Establishment.");
})
pool.on("error",(e)=>{
    console.log(e);
})
export default pool;