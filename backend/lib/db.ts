import mysql, { type Pool } from "mysql2/promise";

const globalForMysql = globalThis as typeof globalThis & { mysqlPool?: Pool };

export function getPool(): Pool {
  if (!process.env.DB_NAME || !process.env.DB_USER) {
    throw new Error("Database is not configured. Copy .env.example to .env.local and set the MySQL connection values.");
  }
  if (!globalForMysql.mysqlPool) {
    globalForMysql.mysqlPool = mysql.createPool({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3306),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD ?? "",
      waitForConnections: true,
      connectionLimit: 10,
      timezone: "+00:00",
      charset: "utf8mb4",
    });
  }
  return globalForMysql.mysqlPool;
}
