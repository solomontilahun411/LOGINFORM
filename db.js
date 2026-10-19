const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "solomon_auth_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool = null;

async function initDatabase() {
  try {
    // 1. First connect without specifying the database to ensure it exists
    const rootConnection = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
    });

    await rootConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await rootConnection.end();

    // 2. Initialize the connection pool pointing to the target database
    pool = mysql.createPool(DB_CONFIG);

    // 3. Create tables if they do not exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        avatar LONGTEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        text TEXT NOT NULL,
        priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
        completed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_todos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        email VARCHAR(150) PRIMARY KEY,
        otp VARCHAR(10) NOT NULL,
        expires_at BIGINT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log(`✅ [MySQL] Connected and verified tables in database "${DB_CONFIG.database}".`);

    // 4. Auto-migration: check if users table is empty; if so, import from users.json
    const [userRows] = await pool.query("SELECT COUNT(*) AS count FROM users");
    if (userRows[0].count === 0) {
      const usersJsonPath = path.join(__dirname, "data", "users.json");
      if (fs.existsSync(usersJsonPath)) {
        try {
          const raw = fs.readFileSync(usersJsonPath, "utf-8");
          const existingUsers = JSON.parse(raw || "[]");
          if (Array.isArray(existingUsers) && existingUsers.length > 0) {
            for (const u of existingUsers) {
              await pool.query(
                `INSERT INTO users (id, username, email, password, avatar, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE username=VALUES(username)`,
                [
                  u.id || Date.now().toString(),
                  u.username,
                  u.email,
                  u.password,
                  u.avatar || null,
                  u.createdAt ? new Date(u.createdAt) : new Date(),
                ]
              );
            }
            console.log(`📦 [MySQL] Migrated ${existingUsers.length} existing user(s) from users.json to MySQL.`);
          }
        } catch (migErr) {
          console.warn("⚠️ Could not auto-migrate users.json:", migErr.message);
        }
      }

      // Check todos.json migration
      const todosJsonPath = path.join(__dirname, "data", "todos.json");
      if (fs.existsSync(todosJsonPath)) {
        try {
          const raw = fs.readFileSync(todosJsonPath, "utf-8");
          const existingTodos = JSON.parse(raw || "[]");
          if (Array.isArray(existingTodos) && existingTodos.length > 0) {
            for (const t of existingTodos) {
              await pool.query(
                `INSERT INTO todos (id, user_id, text, priority, completed, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  t.id || Date.now().toString(),
                  t.userId,
                  t.text,
                  t.priority || "medium",
                  Boolean(t.completed),
                  t.createdAt ? new Date(t.createdAt) : new Date(),
                ]
              );
            }
            console.log(`📦 [MySQL] Migrated ${existingTodos.length} existing todo(s) from todos.json to MySQL.`);
          }
        } catch (todoMigErr) {
          console.warn("⚠️ Could not auto-migrate todos.json:", todoMigErr.message);
        }
      }
    }

    return pool;
  } catch (error) {
    console.error("❌ [MySQL] Database initialization failed:", error.message);
    throw error;
  }
}

function getPool() {
  if (!pool) {
    throw new Error("Database not initialized. Please call initDatabase() first.");
  }
  return pool;
}

module.exports = {
  initDatabase,
  getPool,
};
