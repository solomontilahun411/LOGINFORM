require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { initDatabase, getPool } = require("./db");
const { sendOtpEmail } = require("./mailer");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "solomon_super_secret_jwt_key_2026";

// Middleware (Support up to 15MB for user avatar uploads)
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Serve frontend static files
app.use(express.static(__dirname));

// Helper to generate JWT Token
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// JWT Authentication Middleware for protected routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "ማረጋገጫ ቶከን አልተገኘም (Access denied. No token provided).",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "ቶከኑ ልክ ያልሆነ ወይም ጊዜው ያለፈበት ነው (Invalid or expired token).",
      });
    }

    req.user = decodedUser;
    next();
  });
}

// -------------------------------------------------------------
// 0. HEALTH / STATUS ROUTE
// -------------------------------------------------------------
app.get("/api/health", async (req, res) => {
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    return res.status(200).json({
      status: "healthy",
      database: "MySQL / MariaDB",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// -------------------------------------------------------------
// 1. ROUTE: Register new user (Saved to MySQL)
// -------------------------------------------------------------
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "እባክዎ ሁሉንም መረጃዎች በትክክል ይሙሉ (Please fill in all fields).",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "የይለፍ ቃል ቢያንስ 8 ፊደላት መሆን አለበት (Password must be at least 8 characters).",
      });
    }

    const trimmedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const pool = getPool();

    // Check if username or email already exists
    const [existing] = await pool.query(
      "SELECT id, username, email FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1",
      [trimmedUsername, normalizedEmail]
    );

    if (existing.length > 0) {
      const match = existing[0];
      const conflictMsg =
        match.username.toLowerCase() === trimmedUsername.toLowerCase()
          ? "ይህ የተጠቃሚ ስም አስቀድሞ ተመዝግቧል (Username already registered)."
          : "ይህ ኢሜይል አስቀድሞ ተመዝግቧል (Email already registered).";

      return res.status(409).json({
        success: false,
        message: conflictMsg,
      });
    }

    // Hash the password securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userId = Date.now().toString();

    // Insert new user into MySQL
    await pool.query(
      `INSERT INTO users (id, username, email, password, avatar, created_at)
       VALUES (?, ?, ?, ?, NULL, NOW())`,
      [userId, trimmedUsername, normalizedEmail, hashedPassword]
    );

    const newUser = {
      id: userId,
      username: trimmedUsername,
      email: normalizedEmail,
    };

    const token = generateToken(newUser);

    console.log(`[MYSQL AUTH] New user registered: ${newUser.username} (${newUser.email})`);

    return res.status(201).json({
      success: true,
      message: "ምዝገባዎ በተሳካ ሁኔታ ተጠናቋል! (Registration successful!)",
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        avatar: null,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({
      success: false,
      message: "የሰርቨር ችግር አጋጥሟል (Server error. Please try again).",
    });
  }
});

// -------------------------------------------------------------
// 2. ROUTE: Login existing user (Queries MySQL & returns JWT)
// -------------------------------------------------------------
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "እባክዎ Username እና Password ያስገቡ (Please provide username and password).",
      });
    }

    const pool = getPool();
    const trimmedInput = username.trim();

    // Search by username or email
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1",
      [trimmedInput, trimmedInput]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "የተሳሳተ Username ወይም Password (Invalid username or password).",
      });
    }

    const user = rows[0];

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "የተሳሳተ Username ወይም Password (Invalid username or password).",
      });
    }

    const token = generateToken(user);
    console.log(`[MYSQL AUTH] User logged in: ${user.username}`);

    return res.status(200).json({
      success: true,
      message: `እንኳን ደህና መጡ ${user.username}! (Welcome back!)`,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar || null,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "የሰርቨር ችግር አጋጥሟል (Server error. Please try again).",
    });
  }
});

// -------------------------------------------------------------
// 3. ROUTE: Get Current Authenticated User (Protected via JWT)
// -------------------------------------------------------------
app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT id, username, email, avatar, created_at FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "ተጠቃሚው አልተገኘም (User not found).",
      });
    }

    const user = rows[0];

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar || null,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Get /api/me Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// -------------------------------------------------------------
// 4. ROUTE: Request Password Reset OTP (Saved in MySQL)
// -------------------------------------------------------------
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "እባክዎ ኢሜይልዎን ያስገቡ (Please enter your email).",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const pool = getPool();

    const [rows] = await pool.query(
      "SELECT id, username, email FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "በዚህ ኢሜይል የተመዘገበ አካውንት አልተገኘም (No account found with this email).",
      });
    }

    const user = rows[0];

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store in password_resets table
    await pool.query(
      `INSERT INTO password_resets (email, otp, expires_at, created_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE otp = VALUES(otp), expires_at = VALUES(expires_at), created_at = NOW()`,
      [normalizedEmail, otp, expiresAt]
    );

    // Send real email via Nodemailer
    const emailResult = await sendOtpEmail(user.email, user.username, otp);

    console.log(`\n===========================================`);
    console.log(`🔑 [PASSWORD RESET OTP]`);
    console.log(`To: ${user.email} (Username: ${user.username})`);
    console.log(`OTP Code: ${otp}`);
    console.log(`Live Email Sent: ${emailResult.emailSent ? "YES ✅" : "NO (Demo mode) ℹ️"}`);
    console.log(`Expires in: 10 minutes`);
    console.log(`===========================================\n`);

    const userMsg = emailResult.emailSent
      ? `የማረጋገጫ OTP ኮድ ወደ ኢሜይልዎ (${user.email}) ተልኳል! እባክዎ Inbox ወይም Spam ፎልደርዎን ይመልከቱ።`
      : `የማረጋገጫ OTP ኮድ ተልኳል! ኮዱ፦ ${otp} (OTP Code sent)`;

    return res.status(200).json({
      success: true,
      message: userMsg,
      emailSent: emailResult.emailSent,
      otpDemo: emailResult.emailSent ? undefined : otp,
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({
      success: false,
      message: "የሰርቨር ችግር አጋጥሟል (Server error).",
    });
  }
});

// -------------------------------------------------------------
// 5. ROUTE: Reset Password with OTP
// -------------------------------------------------------------
app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "እባክዎ ሁሉንም መረጃዎች ያስገቡ (Please fill all fields).",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "አዲሱ የይለፍ ቃል ቢያንስ 8 ፊደላት መሆን አለበት (Password must be 8+ characters).",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const pool = getPool();

    const [resetRows] = await pool.query(
      "SELECT * FROM password_resets WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [normalizedEmail]
    );

    if (resetRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "OTP አልተጠየቀም ወይም ጊዜው አልፏል (Invalid or expired OTP).",
      });
    }

    const storedOtpData = resetRows[0];

    if (Date.now() > Number(storedOtpData.expires_at)) {
      await pool.query("DELETE FROM password_resets WHERE LOWER(email) = LOWER(?)", [normalizedEmail]);
      return res.status(400).json({
        success: false,
        message: "የ OTP ኮዱ ጊዜ አልፎበታል (OTP expired).",
      });
    }

    if (storedOtpData.otp !== otp.trim()) {
      return res.status(400).json({
        success: false,
        message: "የተሳሳተ የ OTP ኮድ (Invalid OTP code).",
      });
    }

    // OTP is valid; hash new password and update MySQL
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const [updateResult] = await pool.query(
      "UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)",
      [hashedPassword, normalizedEmail]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "ተጠቃሚው አልተገኘም (User not found).",
      });
    }

    // Clear used OTP
    await pool.query("DELETE FROM password_resets WHERE LOWER(email) = LOWER(?)", [normalizedEmail]);

    console.log(`[MYSQL AUTH] Password reset successfully for: ${normalizedEmail}`);

    return res.status(200).json({
      success: true,
      message: "የይለፍ ቃልዎ በተሳካ ሁኔታ ተቀይሯል! አሁን መግባት ይችላሉ (Password reset successfully!).",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({
      success: false,
      message: "የሰርቨር ችግር አጋጥሟል (Server error).",
    });
  }
});

// -------------------------------------------------------------
// 6. ROUTE: Update User Profile (Username & Avatar in MySQL)
// -------------------------------------------------------------
app.put("/api/profile", authenticateToken, async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const pool = getPool();

    // Verify user exists
    const [userRows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [req.user.id]);
    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "ተጠቃሚው አልተገኘም (User not found).",
      });
    }

    const currentUser = userRows[0];
    let newUsername = currentUser.username;
    let newAvatar = currentUser.avatar;

    if (username !== undefined) {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        return res.status(400).json({
          success: false,
          message: "የተጠቃሚ ስም ባዶ መሆን አይችልም (Username cannot be empty).",
        });
      }

      // Ensure username is unique among other users
      const [taken] = await pool.query(
        "SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ? LIMIT 1",
        [trimmedUsername, req.user.id]
      );

      if (taken.length > 0) {
        return res.status(409).json({
          success: false,
          message: "ይህ የተጠቃሚ ስም አስቀድሞ ተይዟል (Username already taken).",
        });
      }

      newUsername = trimmedUsername;
    }

    if (avatar !== undefined) {
      newAvatar = avatar; // Base64 or null
    }

    // Update in MySQL
    await pool.query(
      "UPDATE users SET username = ?, avatar = ? WHERE id = ?",
      [newUsername, newAvatar, req.user.id]
    );

    const updatedUser = {
      id: currentUser.id,
      username: newUsername,
      email: currentUser.email,
      avatar: newAvatar,
      createdAt: currentUser.created_at,
    };

    const newToken = generateToken(updatedUser);

    console.log(`[MYSQL PROFILE] Updated profile for user: ${updatedUser.username}`);

    return res.status(200).json({
      success: true,
      message: "የመገለጫ መረጃዎ በተሳካ ሁኔታ ተሻሽሏል! (Profile updated successfully!)",
      token: newToken,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar: updatedUser.avatar || null,
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    return res.status(500).json({
      success: false,
      message: "የሰርቨር ችግር አጋጥሟል (Server error).",
    });
  }
});

// -------------------------------------------------------------
// 7. ROUTE: Change Password
// -------------------------------------------------------------
app.put("/api/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "እባክዎ አሮጌውን እና አዲሱን የይለፍ ቃል ያስገቡ (Please provide current and new password).",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "አዲሱ የይለፍ ቃል ቢያንስ 8 ፊደላት መሆን አለበት (Password must be at least 8 characters).",
      });
    }

    const pool = getPool();
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [req.user.id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "ተጠቃሚው አልተገኘም (User not found).",
      });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "ያስገቡት አሮጌ የይለፍ ቃል ትክክል አይደለም (Current password is incorrect).",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, req.user.id]);

    console.log(`[MYSQL AUTH] Password changed for: ${user.username}`);

    return res.status(200).json({
      success: true,
      message: "የይለፍ ቃልዎ በተሳካ ሁኔታ ተቀይሯል! (Password changed successfully!)",
    });
  } catch (error) {
    console.error("Change Password Error:", error);
    return res.status(500).json({
      success: false,
      message: "የሰርቨር ችግር አጋጥሟል (Server error).",
    });
  }
});

// -------------------------------------------------------------
// 8. ROUTE: Get User's Personal Todos from MySQL
// -------------------------------------------------------------
app.get("/api/todos", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, user_id AS userId, text, priority, completed, created_at AS createdAt
       FROM todos
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    const formattedTodos = rows.map((t) => ({
      ...t,
      completed: Boolean(t.completed),
    }));

    return res.status(200).json({
      success: true,
      todos: formattedTodos,
    });
  } catch (error) {
    console.error("Get Todos Error:", error);
    return res.status(500).json({ success: false, message: "Error fetching todos" });
  }
});

// -------------------------------------------------------------
// 9. ROUTE: Create New Todo in MySQL
// -------------------------------------------------------------
app.post("/api/todos", authenticateToken, async (req, res) => {
  try {
    const { text, priority } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "የስራው ማስታወሻ ባዶ መሆን አይችልም (Task text is required).",
      });
    }

    const validPriorities = ["low", "medium", "high"];
    const chosenPriority = validPriorities.includes(priority) ? priority : "medium";
    const todoId = Date.now().toString();

    const pool = getPool();
    await pool.query(
      `INSERT INTO todos (id, user_id, text, priority, completed, created_at)
       VALUES (?, ?, ?, ?, false, NOW())`,
      [todoId, req.user.id, text.trim(), chosenPriority]
    );

    const newTodo = {
      id: todoId,
      userId: req.user.id,
      text: text.trim(),
      priority: chosenPriority,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    console.log(`[MYSQL TODO] Task created by ${req.user.username}: "${newTodo.text}"`);

    return res.status(201).json({
      success: true,
      message: "ስራው በተሳካ ሁኔታ ተመዝግቧል! (Task added successfully!)",
      todo: newTodo,
    });
  } catch (error) {
    console.error("Add Todo Error:", error);
    return res.status(500).json({ success: false, message: "Error adding todo" });
  }
});

// -------------------------------------------------------------
// 10. ROUTE: Update Todo in MySQL (toggle complete, edit text or priority)
// -------------------------------------------------------------
app.put("/api/todos/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, priority, completed } = req.body;

    const pool = getPool();
    const [existing] = await pool.query(
      "SELECT * FROM todos WHERE id = ? AND user_id = ? LIMIT 1",
      [id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "ስራው አልተገኘም (Task not found).",
      });
    }

    const currentTodo = existing[0];
    let updatedText = currentTodo.text;
    let updatedPriority = currentTodo.priority;
    let updatedCompleted = currentTodo.completed;

    if (text !== undefined && text.trim()) {
      updatedText = text.trim();
    }
    if (priority !== undefined) {
      const validPriorities = ["low", "medium", "high"];
      if (validPriorities.includes(priority)) {
        updatedPriority = priority;
      }
    }
    if (completed !== undefined) {
      updatedCompleted = Boolean(completed);
    }

    await pool.query(
      "UPDATE todos SET text = ?, priority = ?, completed = ? WHERE id = ? AND user_id = ?",
      [updatedText, updatedPriority, updatedCompleted, id, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: "ስራው ተሻሽሏል (Task updated successfully).",
      todo: {
        id,
        userId: req.user.id,
        text: updatedText,
        priority: updatedPriority,
        completed: Boolean(updatedCompleted),
        createdAt: currentTodo.created_at,
      },
    });
  } catch (error) {
    console.error("Update Todo Error:", error);
    return res.status(500).json({ success: false, message: "Error updating todo" });
  }
});

// -------------------------------------------------------------
// 11. ROUTE: Delete Todo in MySQL
// -------------------------------------------------------------
app.delete("/api/todos/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [result] = await pool.query(
      "DELETE FROM todos WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "ስራው አልተገኘም (Task not found).",
      });
    }

    return res.status(200).json({
      success: true,
      message: "ስራው ተሰርዟል! (Task deleted successfully!)",
    });
  } catch (error) {
    console.error("Delete Todo Error:", error);
    return res.status(500).json({ success: false, message: "Error deleting todo" });
  }
});

// Start Express Server after MySQL initialization
async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`\n===========================================`);
      console.log(`🚀 Server is running on: http://localhost:${PORT}`);
      console.log(`🐬 Database: MySQL / MariaDB (Connected & Ready)`);
      console.log(`📁 Frontend served from: ${__dirname}`);
      console.log(`🔐 JWT Auth & OTP Reset APIs Enabled`);
      console.log(`===========================================\n`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
