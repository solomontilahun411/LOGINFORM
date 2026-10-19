const API_BASE_URL = window.location.origin.startsWith("http")
  ? ""
  : "http://localhost:5000";

const toast = document.getElementById("toast");
let toastTimer = null;
let currentUserData = null;
let tasks = [];
let activeFilter = "all";

// Toast Helper
function showToast(message, type = "info") {
  if (!toast) return;
  if (toastTimer) clearTimeout(toastTimer);

  toast.textContent = message;
  toast.className = `toast ${type} show`;

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3800);
}

// Refresh Lucide Icons Helper
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

// Get stored JWT token
function getAuthToken() {
  return localStorage.getItem("authToken");
}

// ==============================================================
// 1. SESSION MANAGEMENT & PROFILE RENDERING
// ==============================================================
async function loadUserSession() {
  const token = getAuthToken();

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (response.ok && data.success && data.user) {
      currentUserData = data.user;
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      renderUserProfile(data.user);
      loadTasks();
    } else {
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      window.location.href = "index.html";
    }
  } catch (error) {
    console.error("Session verification error:", error);
    const cachedUser = localStorage.getItem("currentUser");
    if (cachedUser) {
      try {
        currentUserData = JSON.parse(cachedUser);
        renderUserProfile(currentUserData);
        loadTasks();
      } catch (e) {
        window.location.href = "index.html";
      }
    } else {
      window.location.href = "index.html";
    }
  }
}

function renderUserProfile(user) {
  if (!user) return;

  const heroUsername = document.getElementById("heroUsername");
  const profileUsername = document.getElementById("profileUsername");
  const profileEmail = document.getElementById("profileEmail");
  const profileId = document.getElementById("profileId");
  const profileJoined = document.getElementById("profileJoined");
  const userAvatar = document.getElementById("userAvatar");
  const modalAvatarPreview = document.getElementById("modalAvatarPreview");

  // Text details
  if (heroUsername) heroUsername.textContent = user.username;
  if (profileUsername) profileUsername.textContent = user.username;
  if (profileEmail) profileEmail.textContent = user.email;
  if (profileId) profileId.textContent = `#${(user.id || "").slice(-6)}`;

  if (profileJoined && user.createdAt) {
    const date = new Date(user.createdAt);
    profileJoined.textContent = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Avatar rendering: show uploaded image or monogram initials
  const initials = (user.username || "SD").slice(0, 2).toUpperCase();

  if (user.avatar) {
    const imgHtml = `<img src="${user.avatar}" alt="${user.username}" />`;
    if (userAvatar) userAvatar.innerHTML = imgHtml;
    if (modalAvatarPreview) modalAvatarPreview.innerHTML = imgHtml;
  } else {
    if (userAvatar) userAvatar.textContent = initials;
    if (modalAvatarPreview) modalAvatarPreview.textContent = initials;
  }

  // Pre-fill modal input fields
  const editUsernameInput = document.getElementById("editUsernameInput");
  const displayEmailInput = document.getElementById("displayEmailInput");
  if (editUsernameInput) editUsernameInput.value = user.username || "";
  if (displayEmailInput) displayEmailInput.value = user.email || "";

  refreshIcons();
}

// ==============================================================
// 2. PROFILE EDIT, PASSWORD CHANGE & MODAL CONTROLS
// ==============================================================
const settingsModal = document.getElementById("settingsModal");
const closeSettingsModalBtn = document.getElementById("closeSettingsModalBtn");
const modalBackdrop = document.getElementById("modalBackdrop");
const tabProfileBtn = document.getElementById("tabProfileBtn");
const tabPasswordBtn = document.getElementById("tabPasswordBtn");
const tabProfile = document.getElementById("tabProfile");
const tabPassword = document.getElementById("tabPassword");

function openSettingsModal(targetTab = "tabProfile") {
  if (!settingsModal) return;
  switchSettingsTab(targetTab);
  settingsModal.classList.add("show");
  refreshIcons();
}

function closeSettingsModal() {
  if (!settingsModal) return;
  settingsModal.classList.remove("show");
}

function switchSettingsTab(tabName) {
  if (tabName === "tabProfile") {
    tabProfileBtn?.classList.add("active");
    tabPasswordBtn?.classList.remove("active");
    tabProfile?.classList.add("active");
    tabPassword?.classList.remove("active");
  } else {
    tabPasswordBtn?.classList.add("active");
    tabProfileBtn?.classList.remove("active");
    tabPassword?.classList.add("active");
    tabProfile?.classList.remove("active");
  }
}

// Modal open buttons
document.getElementById("openProfileModalBtn")?.addEventListener("click", () => openSettingsModal("tabProfile"));
document.getElementById("openPasswordModalBtn")?.addEventListener("click", () => openSettingsModal("tabPassword"));
document.getElementById("openSettingsNavBtn")?.addEventListener("click", () => openSettingsModal("tabProfile"));
document.getElementById("openSettingsCardBtn")?.addEventListener("click", () => openSettingsModal("tabProfile"));

closeSettingsModalBtn?.addEventListener("click", closeSettingsModal);
modalBackdrop?.addEventListener("click", closeSettingsModal);

tabProfileBtn?.addEventListener("click", () => switchSettingsTab("tabProfile"));
tabPasswordBtn?.addEventListener("click", () => switchSettingsTab("tabPassword"));

// Close on Escape key
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && settingsModal?.classList.contains("show")) {
    closeSettingsModal();
  }
});

// Edit Profile Form Submission (Change Username)
const editProfileForm = document.getElementById("editProfileForm");
if (editProfileForm) {
  editProfileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = getAuthToken();
    const editUsernameInput = document.getElementById("editUsernameInput");
    const saveProfileBtn = document.getElementById("saveProfileBtn");
    const newUsername = editUsernameInput ? editUsernameInput.value.trim() : "";

    if (!newUsername) {
      showToast("እባክዎ የተጠቃሚ ስም ያስገቡ (Please enter a username).", "error");
      return;
    }

    try {
      if (saveProfileBtn) saveProfileBtn.disabled = true;

      const res = await fetch(`${API_BASE_URL}/api/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ username: newUsername }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.token) localStorage.setItem("authToken", data.token);
        currentUserData = data.user;
        localStorage.setItem("currentUser", JSON.stringify(data.user));
        renderUserProfile(data.user);
        showToast(data.message || "የመገለጫ ስምዎ በተሳካ ሁኔታ ተሻሽሏል!", "success");
        closeSettingsModal();
      } else {
        showToast(data.message || "ስም መቀየር አልተቻለም (Update failed).", "error");
      }
    } catch (err) {
      showToast("የሰርቨር ችግር አጋጥሟል (Server connection error).", "error");
    } finally {
      if (saveProfileBtn) saveProfileBtn.disabled = false;
    }
  });
}

// Change Password Form Submission
const changePasswordForm = document.getElementById("changePasswordForm");
if (changePasswordForm) {
  changePasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = getAuthToken();
    const currentPasswordInput = document.getElementById("currentPasswordInput");
    const newPasswordInput = document.getElementById("newPasswordInput");
    const confirmNewPasswordInput = document.getElementById("confirmNewPasswordInput");
    const savePasswordBtn = document.getElementById("savePasswordBtn");

    const currentPassword = currentPasswordInput?.value || "";
    const newPassword = newPasswordInput?.value || "";
    const confirmPassword = confirmNewPasswordInput?.value || "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("እባክዎ ሁሉንም የይለፍ ቃል ቦታዎች ይሙሉ (Please fill all password fields).", "error");
      return;
    }

    if (newPassword.length < 8) {
      showToast("አዲሱ የይለፍ ቃል ቢያንስ 8 ፊደላት መሆን አለበት (Password must be 8+ chars).", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("አዲሱ የይለፍ ቃል እና ማረጋገጫው አይመሳሰሉም (Passwords do not match)!", "error");
      return;
    }

    try {
      if (savePasswordBtn) savePasswordBtn.disabled = true;

      const res = await fetch(`${API_BASE_URL}/api/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast(data.message || "የይለፍ ቃልዎ በተሳካ ሁኔታ ተቀይሯል!", "success");
        changePasswordForm.reset();
        closeSettingsModal();
      } else {
        showToast(data.message || "የይለፍ ቃል መቀየር አልተቻለም (Password change failed).", "error");
      }
    } catch (err) {
      showToast("የሰርቨር ችግር አጋጥሟል (Server error).", "error");
    } finally {
      if (savePasswordBtn) savePasswordBtn.disabled = false;
    }
  });
}

// Password Eye Toggle
document.querySelectorAll(".toggle-password-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-target");
    const input = document.getElementById(targetId);
    if (!input) return;

    if (input.type === "password") {
      input.type = "text";
      btn.innerHTML = `<i data-lucide="eye-off"></i>`;
    } else {
      input.type = "password";
      btn.innerHTML = `<i data-lucide="eye"></i>`;
    }
    refreshIcons();
  });
});

// ==============================================================
// 3. AVATAR / PROFILE PHOTO UPLOAD & REMOVE
// ==============================================================
// Client-side image compression to keep payload small & fast
function compressImage(file, maxSize = 256, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

async function uploadAvatarFile(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("እባክዎ ትክክለኛ የፎቶ ፋይል ይምረጡ (Please select a valid image).", "error");
    return;
  }

  showToast("ፎቶው እየተጫነ ነው... (Uploading photo...)", "info");

  try {
    const compressedBase64 = await compressImage(file, 280, 0.85);
    const token = getAuthToken();

    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ avatar: compressedBase64 }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      currentUserData = data.user;
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      renderUserProfile(data.user);
      showToast("የፕሮፋይል ፎቶ በተሳካ ሁኔታ ተጭኗል! (Avatar updated successfully!)", "success");
    } else {
      showToast(data.message || "ፎቶ መጫን አልተቻለም (Failed to upload photo).", "error");
    }
  } catch (err) {
    console.error("Avatar upload error:", err);
    showToast("ፎቶውን በሚጭኑበት ጊዜ ችግር አጋጥሟል (Error uploading avatar).", "error");
  }
}

// Direct camera click on profile card
const triggerAvatarUploadBtn = document.getElementById("triggerAvatarUploadBtn");
const directAvatarInput = document.getElementById("directAvatarInput");
if (triggerAvatarUploadBtn && directAvatarInput) {
  triggerAvatarUploadBtn.addEventListener("click", () => directAvatarInput.click());
  directAvatarInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) uploadAvatarFile(file);
    e.target.value = "";
  });
}

// Modal Avatar Input
const modalAvatarInput = document.getElementById("modalAvatarInput");
if (modalAvatarInput) {
  modalAvatarInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) uploadAvatarFile(file);
    e.target.value = "";
  });
}

// Remove Avatar Button
const removeAvatarBtn = document.getElementById("removeAvatarBtn");
if (removeAvatarBtn) {
  removeAvatarBtn.addEventListener("click", async () => {
    if (!currentUserData || !currentUserData.avatar) {
      showToast("አስቀድሞ የተቀመጠ ፎቶ የለም (No custom photo to remove).", "info");
      return;
    }

    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar: null }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        currentUserData = data.user;
        localStorage.setItem("currentUser", JSON.stringify(data.user));
        renderUserProfile(data.user);
        showToast("የፕሮፋይል ፎቶ ተሰርዟል! (Avatar removed successfully!)", "success");
      }
    } catch (err) {
      showToast("ፎቶውን መሰረዝ አልተቻለም (Could not remove avatar).", "error");
    }
  });
}

// ==============================================================
// 4. PERSONAL TASKS & NOTES (CRUD)
// ==============================================================
const tasksList = document.getElementById("tasksList");
const addTaskForm = document.getElementById("addTaskForm");
const taskTextInput = document.getElementById("taskTextInput");
const taskPrioritySelect = document.getElementById("taskPrioritySelect");
const addTaskSubmitBtn = document.getElementById("addTaskSubmitBtn");
const tasksStatText = document.getElementById("tasksStatText");
const countAll = document.getElementById("countAll");
const countActive = document.getElementById("countActive");
const countCompleted = document.getElementById("countCompleted");
const filterSummary = document.getElementById("filterSummary");

// Load tasks from backend
async function loadTasks() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/todos`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await res.json();
    if (res.ok && data.success) {
      tasks = Array.isArray(data.todos) ? data.todos : [];
      renderTasks();
    } else {
      if (tasksList) tasksList.innerHTML = `<div class="empty-tasks"><p>Could not load tasks</p></div>`;
    }
  } catch (err) {
    console.error("Fetch tasks error:", err);
    if (tasksList) tasksList.innerHTML = `<div class="empty-tasks"><p>Connection error loading tasks</p></div>`;
  }
}

// Update task stats and counters
function updateTaskStats() {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const active = total - completed;

  if (countAll) countAll.textContent = total;
  if (countActive) countActive.textContent = active;
  if (countCompleted) countCompleted.textContent = completed;

  if (tasksStatText) tasksStatText.textContent = `${completed}/${total} Done`;
  if (filterSummary) filterSummary.textContent = `${completed} of ${total} tasks completed`;
}

// Render tasks based on filter
function renderTasks() {
  if (!tasksList) return;
  updateTaskStats();

  let filtered = tasks;
  if (activeFilter === "active") {
    filtered = tasks.filter((t) => !t.completed);
  } else if (activeFilter === "completed") {
    filtered = tasks.filter((t) => t.completed);
  }

  if (filtered.length === 0) {
    let emptyMsg = "No tasks yet! Add your first task above.";
    if (activeFilter === "active") emptyMsg = "No active tasks! You are all caught up! 🎉";
    if (activeFilter === "completed") emptyMsg = "No completed tasks yet. Check off a task when done!";

    tasksList.innerHTML = `
      <div class="empty-tasks">
        <i data-lucide="clipboard-list"></i>
        <p>${emptyMsg}</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  tasksList.innerHTML = filtered
    .map((task) => {
      const priorityClass = `priority-${task.priority || "medium"}`;
      const completedClass = task.completed ? "completed" : "";
      const checkIcon = task.completed ? `<i data-lucide="check"></i>` : "";
      const timeFormatted = task.createdAt
        ? new Date(task.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "";

      return `
        <div class="task-item ${priorityClass} ${completedClass}" data-id="${task.id}">
          <div class="task-left">
            <button type="button" class="task-checkbox-btn" onclick="toggleTaskCompletion('${task.id}')" aria-label="Toggle task status">
              ${checkIcon}
            </button>
            <span class="task-text">${escapeHtml(task.text)}</span>
          </div>
          <div class="task-right">
            <span class="priority-pill ${task.priority || "medium"}">${task.priority || "medium"}</span>
            <span class="task-time">${timeFormatted}</span>
            <button type="button" class="btn-task-delete" onclick="deleteTaskItem('${task.id}')" title="Delete Task">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  refreshIcons();
}

// Add New Task
if (addTaskForm) {
  addTaskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = taskTextInput ? taskTextInput.value.trim() : "";
    const priority = taskPrioritySelect ? taskPrioritySelect.value : "medium";
    const token = getAuthToken();

    if (!text) {
      showToast("እባክዎ የስራ ማስታወሻ ይጻፉ (Please enter a task name).", "error");
      return;
    }

    try {
      if (addTaskSubmitBtn) addTaskSubmitBtn.disabled = true;

      const res = await fetch(`${API_BASE_URL}/api/todos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ text, priority }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.todo) {
        tasks.unshift(data.todo);
        if (taskTextInput) taskTextInput.value = "";
        renderTasks();
        showToast("ስራው በተሳካ ሁኔታ ተመዝግቧል! (Task added!)", "success");
      } else {
        showToast(data.message || "ስራ መመዝገብ አልተቻለም (Failed to add task).", "error");
      }
    } catch (err) {
      showToast("የሰርቨር ችግር አጋጥሟል (Server error).", "error");
    } finally {
      if (addTaskSubmitBtn) addTaskSubmitBtn.disabled = false;
    }
  });
}

// Toggle Task Completion
window.toggleTaskCompletion = async function (id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  const originalState = task.completed;
  task.completed = !task.completed;
  renderTasks();

  try {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/todos/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ completed: task.completed }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      task.completed = originalState;
      renderTasks();
      showToast("ስራውን ማስተካከል አልተቻለም", "error");
    }
  } catch (err) {
    task.completed = originalState;
    renderTasks();
    showToast("የግንኙነት ችግር አጋጥሟል", "error");
  }
};

// Delete Task Item
window.deleteTaskItem = async function (id) {
  const token = getAuthToken();
  const taskIndex = tasks.findIndex((t) => t.id === id);
  if (taskIndex === -1) return;

  const removedTask = tasks.splice(taskIndex, 1)[0];
  renderTasks();

  try {
    const res = await fetch(`${API_BASE_URL}/api/todos/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast("ስራው ተሰርዟል! (Task deleted!)", "info");
    } else {
      tasks.splice(taskIndex, 0, removedTask);
      renderTasks();
      showToast("ስራውን መሰረዝ አልተቻለም", "error");
    }
  } catch (err) {
    tasks.splice(taskIndex, 0, removedTask);
    renderTasks();
    showToast("የሰርቨር ችግር አጋጥሟል", "error");
  }
};

// Filter tabs listener
document.querySelectorAll(".filter-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.getAttribute("data-filter") || "all";
    renderTasks();
  });
});

// Escape HTML helper
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

// ==============================================================
// 5. LOGOUT & REFRESH SESSION HANDLERS
// ==============================================================
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    showToast("በተሳካ ሁኔታ ወጥተዋል! (Logged out successfully)", "info");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 800);
  });
}

const refreshSessionBtn = document.getElementById("refreshSessionBtn");
if (refreshSessionBtn) {
  refreshSessionBtn.addEventListener("click", async () => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = "index.html";
      return;
    }

    try {
      refreshSessionBtn.disabled = true;
      const response = await fetch(`${API_BASE_URL}/api/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await response.json();

      if (response.ok && data.success) {
        showToast("የእርስዎ Session አስተማማኝ እና ንቁ ነው! (JWT Verified)", "success");
        renderUserProfile(data.user);
        loadTasks();
      } else {
        showToast("Session ጊዜው አልፏል። እባክዎ እንደገና ይግቡ።", "error");
        setTimeout(() => {
          localStorage.removeItem("authToken");
          window.location.href = "index.html";
        }, 1200);
      }
    } catch (error) {
      showToast("ከሰርቨሩ ጋር መገናኘት አልተቻለም (Could not reach server).", "error");
    } finally {
      refreshSessionBtn.disabled = false;
    }
  });
}

// Initial Boot
loadUserSession();
