const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "solomon_super_secret_jwt_key_2026";

// Middleware (Support up to 15MB for user avatar uploads)
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Serve frontend static files
app.use(express.static(__dirname));

// Database file paths
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TODOS_FILE = path.join(DATA_DIR, "todos.json");

// Ensure data folder and data files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), "utf-8");
}
if (!fs.existsSync(TODOS_FILE)) {
  fs.writeFileSync(TODOS_FILE, JSON.stringify([], null, 2), "utf-8");
}

// In-memory OTP storage for password reset: email -> { otp, expiresAt }
const otpStore = new Map();

// Helper functions to read/write users
function getUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(data || "[]");
  } catch (error) {
    console.error("Error reading users:", error);
    return [];
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving users:", error);
  }
}

// Helper functions to read/write todos
function getTodos() {
  try {
    const data = fs.readFileSync(TODOS_FILE, "utf-8");
    return JSON.parse(data || "[]");
  } catch (error) {
    console.error("Error reading todos:", error);
    return [];
  }
}

function saveTodos(todos) {
  try {
    fs.writeFileSync(TODOS_FILE, JSON.stringify(todos, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving todos:", error);
  }
}

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
// 1. ROUTE: Register new user
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

    const users = getUsers();

    // Check if username or email already exists
    const existingUser = users.find(
      (u) =>
        u.username.toLowerCase() === username.trim().toLowerCase() ||
        u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "ይህ ስም ወይም ኢሜይል አስቀድሞ ተመዝግቧል (Username or Email already registered).",
      });
    }

    // Hash the password securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      id: Date.now().toString(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    const token = generateToken(newUser);

    console.log(`[AUTH] New user registered: ${newUser.username}`);

    return res.status(201).json({
      success: true,
      message: "ምዝገባዎ በተሳካ ሁኔታ ተጠናቋል! (Registration successful!)",
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        avatar: null,
        createdAt: newUser.createdAt,
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
// 2. ROUTE: Login existing user (Returns JWT Token)
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

    const users = getUsers();
    const user = users.find(
      (u) =>
        u.username.toLowerCase() === username.trim().toLowerCase() ||
        u.email.toLowerCase() === username.trim().toLowerCase()
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "የተሳሳተ Username ወይም Password (Invalid username or password).",
      });
    }

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "የተሳሳተ Username ወይም Password (Invalid username or password).",
      });
    }

    const token = generateToken(user);
    console.log(`[AUTH] User logged in: ${user.username}`);

    return res.status(200).json({
      success: true,
      message: `እንኳን ደህና መጡ ${user.username}! (Welcome back!)`,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar || null,
        createdAt: user.createdAt,
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
app.get("/api/me", authenticateToken, (req, res) => {
  const users = getUsers();
  const user = users.find((u) => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "ተጠቃሚው አልተገኘም (User not found).",
    });
  }

  return res.status(200).json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar || null,
      createdAt: user.createdAt,
    },
  });
});

// -------------------------------------------------------------
// 4. ROUTE: Request Password Reset OTP
// -------------------------------------------------------------
app.post("/api/forgot-password", (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "እባክዎ ኢሜይልዎን ያስገቡ (Please enter your email).",
      });
    }

    const users = getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "በዚህ ኢሜይል የተመዘገበ አካውንት አልተገኘም (No account found with this email).",
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(user.email.toLowerCase(), { otp, expiresAt });

    console.log(`\n===========================================`);
    console.log(`🔑 [PASSWORD RESET OTP]`);
    console.log(`To: ${user.email}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`Expires in: 10 minutes`);
    console.log(`===========================================\n`);

    return res.status(200).json({
      success: true,
      message: `የማረጋገጫ OTP ኮድ ተልኳል! ኮዱ፦ ${otp} (OTP code sent successfully!)`,
      otpDemo: otp, // Returned for easy testing during development
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

    const storedOtpData = otpStore.get(email.trim().toLowerCase());

    if (!storedOtpData) {
      return res.status(400).json({
        success: false,
        message: "OTP አልተጠየቀም ወይም ጊዜው አልፏል (Invalid or expired OTP).",
      });
    }

    if (Date.now() > storedOtpData.expiresAt) {
      otpStore.delete(email.trim().toLowerCase());
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

    // OTP is valid, hash new password
    const users = getUsers();
    const userIndex = users.findIndex(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "ተጠቃሚው አልተገኘም (User not found).",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    users[userIndex].password = hashedPassword;
    saveUsers(users);

    // Clear used OTP
    otpStore.delete(email.trim().toLowerCase());

    console.log(`[AUTH] Password reset successfully for: ${users[userIndex].username}`);

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
// 6. ROUTE: Update User Profile (Username & Avatar)
// -------------------------------------------------------------
app.put("/api/profile", authenticateToken, (req, res) => {
  try {
    const { username, avatar } = req.body;
    const users = getUsers();
    const userIndex = users.findIndex((u) => u.id === req.user.id);

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "ተጠቃሚው አልተገኘም (User not found).",
      });
    }

    if (username !== undefined) {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        return res.status(400).json({
          success: false,
          message: "የተጠቃሚ ስም ባዶ መሆን አይችልም (Username cannot be empty).",
        });
      }

      // Ensure username is unique among other users
      const isTaken = users.some(
        (u) =>
          u.id !== req.user.id &&
          u.username.toLowerCase() === trimmedUsername.toLowerCase()
      );
      if (isTaken) {
        return res.status(409).json({
          success: false,
          message: "ይህ የተጠቃሚ ስም አስቀድሞ ተይዟል (Username already taken).",
        });
      }
      users[userIndex].username = trimmedUsername;
    }

    if (avatar !== undefined) {
      // Store Base64 data URL or null to clear avatar
      users[userIndex].avatar = avatar;
    }

    saveUsers(users);

    const updatedUser = users[userIndex];
    const newToken = generateToken(updatedUser);

    console.log(`[PROFILE] Updated profile for user: ${updatedUser.username}`);

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

    const users = getUsers();
    const userIndex = users.findIndex((u) => u.id === req.user.id);

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "ተጠቃሚው አልተገኘም (User not found).",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, users[userIndex].password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "ያስገቡት አሮጌ የይለፍ ቃል ትክክል አይደለም (Current password is incorrect).",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    users[userIndex].password = hashedPassword;
    saveUsers(users);

    console.log(`[AUTH] Password changed for: ${users[userIndex].username}`);

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
// 8. ROUTE: Get User's Personal Todos
// -------------------------------------------------------------
app.get("/api/todos", authenticateToken, (req, res) => {
  try {
    const todos = getTodos();
    const userTodos = todos
      .filter((t) => t.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      success: true,
      todos: userTodos,
    });
  } catch (error) {
    console.error("Get Todos Error:", error);
    return res.status(500).json({ success: false, message: "Error fetching todos" });
  }
});

// -------------------------------------------------------------
// 9. ROUTE: Create New Todo
// -------------------------------------------------------------
app.post("/api/todos", authenticateToken, (req, res) => {
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

    const todos = getTodos();
    const newTodo = {
      id: Date.now().toString(),
      userId: req.user.id,
      text: text.trim(),
      priority: chosenPriority,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    todos.push(newTodo);
    saveTodos(todos);

    console.log(`[TODO] Task created by ${req.user.username}: "${newTodo.text}"`);

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
// 10. ROUTE: Update Todo (toggle complete, edit text or priority)
// -------------------------------------------------------------
app.put("/api/todos/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { text, priority, completed } = req.body;

    const todos = getTodos();
    const todoIndex = todos.findIndex(
      (t) => t.id === id && t.userId === req.user.id
    );

    if (todoIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "ስራው አልተገኘም (Task not found).",
      });
    }

    if (text !== undefined && text.trim()) {
      todos[todoIndex].text = text.trim();
    }
    if (priority !== undefined) {
      const validPriorities = ["low", "medium", "high"];
      if (validPriorities.includes(priority)) {
        todos[todoIndex].priority = priority;
      }
    }
    if (completed !== undefined) {
      todos[todoIndex].completed = Boolean(completed);
    }

    saveTodos(todos);

    return res.status(200).json({
      success: true,
      message: "ስራው ተሻሽሏል (Task updated successfully).",
      todo: todos[todoIndex],
    });
  } catch (error) {
    console.error("Update Todo Error:", error);
    return res.status(500).json({ success: false, message: "Error updating todo" });
  }
});

// -------------------------------------------------------------
// 11. ROUTE: Delete Todo
// -------------------------------------------------------------
app.delete("/api/todos/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const todos = getTodos();
    const initialLength = todos.length;
    const filteredTodos = todos.filter(
      (t) => !(t.id === id && t.userId === req.user.id)
    );

    if (filteredTodos.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: "ስራው አልተገኘም (Task not found).",
      });
    }

    saveTodos(filteredTodos);

    return res.status(200).json({
      success: true,
      message: "ስራው ተሰርዟል! (Task deleted successfully!)",
    });
  } catch (error) {
    console.error("Delete Todo Error:", error);
    return res.status(500).json({ success: false, message: "Error deleting todo" });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`🚀 Server is running on: http://localhost:${PORT}`);
  console.log(`📁 Frontend served from: ${__dirname}`);
  console.log(`🔐 JWT Auth & OTP Reset APIs Enabled`);
  console.log(`===========================================\n`);
});
