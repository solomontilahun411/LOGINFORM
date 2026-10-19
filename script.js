const container = document.getElementById("container");
const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");
const welcomeSignUp = document.getElementById("welcomeSignUp");
const welcomeSignIn = document.getElementById("welcomeSignIn");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const forgotPassword = document.getElementById("forgotPassword");
const toast = document.getElementById("toast");

// Reset Modal elements
const resetModal = document.getElementById("resetModal");
const closeResetModal = document.getElementById("closeResetModal");
const requestOtpForm = document.getElementById("requestOtpForm");
const verifyOtpForm = document.getElementById("verifyOtpForm");
const resetStep1 = document.getElementById("resetStep1");
const resetStep2 = document.getElementById("resetStep2");
const backToStep1 = document.getElementById("backToStep1");

let currentResetEmail = "";
let toastTimer = null;

const API_BASE_URL = window.location.origin.startsWith("http")
  ? ""
  : "http://localhost:5000";

// Display modern floating notification
function showToast(message, type = "info") {
  if (!toast) return;
  if (toastTimer) clearTimeout(toastTimer);

  toast.textContent = message;
  toast.className = `toast ${type} show`;

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

// Check if user already has an active session
async function checkExistingSession() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/me`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      // Already logged in! Redirect to dashboard
      window.location.href = "dashboard.html";
    } else {
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
    }
  } catch (e) {
    // Server offline or network issue, do not redirect
  }
}
checkExistingSession();

// Switch between Login and Register views
function openRegister(event) {
  if (event) event.preventDefault();
  container.classList.add("active");
}

function openLogin(event) {
  if (event) event.preventDefault();
  container.classList.remove("active");
}

showRegister.addEventListener("click", openRegister);
showLogin.addEventListener("click", openLogin);
welcomeSignUp.addEventListener("click", openRegister);
welcomeSignIn.addEventListener("click", openLogin);

// Toggle password visibility (show/hide password)
function setupToggleButtons() {
  const toggleButtons = document.querySelectorAll(".toggle-password");
  toggleButtons.forEach((btn) => {
    btn.onclick = function () {
      const targetId = this.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.getAttribute("type") === "password";
      input.setAttribute("type", isPassword ? "text" : "password");

      this.innerHTML = isPassword ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
      if (window.lucide) {
        lucide.createIcons();
      }
    };
  });
}
setupToggleButtons();

// Register form submission with backend API call
registerForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const submitBtn = registerForm.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;

  const username = document.getElementById("registerUsername").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password.length < 8) {
    showToast("የይለፍ ቃል ቢያንስ 8 ፊደላት መሆን አለበት (Password must be 8+ characters).", "error");
    return;
  }

  if (password !== confirmPassword) {
    showToast("የይለፍ ቃሎቹ አይመሳሰሉም! (Passwords do not match).", "error");
    document.getElementById("confirmPassword").focus();
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Registering...";

    const response = await fetch(`${API_BASE_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showToast(data.message || "ምዝገባዎ በተሳካ ሁኔታ ተጠናቋል!", "success");

      // Save token and user details
      if (data.token) {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("currentUser", JSON.stringify(data.user));
      }

      registerForm.reset();

      // Redirect directly to dashboard
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 1000);
    } else {
      showToast(data.message || "Registration failed. Please try again.", "error");
    }
  } catch (error) {
    console.error("Fetch error:", error);
    showToast("Backend ሰርቨሩ አልተገናኘም! እባክዎ ሰርቨሩን ያብሩት (npm start)", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  }
});

// Login form submission with backend API call
loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;

  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) {
    showToast("እባክዎ Username እና Password ያስገቡ።", "error");
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showToast(data.message || `እንኳን ደህና መጡ ${username}!`, "success");

      // Save JWT token and user info
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("currentUser", JSON.stringify(data.user));

      loginForm.reset();

      // Smoothly navigate to dashboard
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 900);
    } else {
      showToast(data.message || "የተሳሳተ መረጃ! እባክዎ በድጋሚ ይሞክሩ።", "error");
    }
  } catch (error) {
    console.error("Fetch error:", error);
    showToast("Backend ሰርቨሩ አልተገናኘም! እባክዎ ሰርቨሩን ያብሩት (npm start)", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  }
});

// -------------------------------------------------------------
// Forgot Password & OTP Flow
// -------------------------------------------------------------
if (forgotPassword && resetModal) {
  // Open modal
  forgotPassword.addEventListener("click", function (event) {
    event.preventDefault();
    resetModal.classList.add("open");
    resetModal.setAttribute("aria-hidden", "false");
    resetStep1.classList.add("active");
    resetStep2.classList.remove("active");
    document.getElementById("resetEmail").focus();
  });

  // Close modal
  function closeModal() {
    resetModal.classList.remove("open");
    resetModal.setAttribute("aria-hidden", "true");
  }

  closeResetModal.addEventListener("click", closeModal);
  resetModal.addEventListener("click", function (event) {
    if (event.target === resetModal) closeModal();
  });

  // Step 1: Request OTP
  requestOtpForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const emailInput = document.getElementById("resetEmail");
    const email = emailInput.value.trim();
    const btn = requestOtpForm.querySelector('button[type="submit"]');

    if (!email) return;

    try {
      btn.disabled = true;
      btn.textContent = "Sending OTP...";

      const res = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        currentResetEmail = email;
        showToast(data.message || "የ 6 ድጅት OTP ኮድ ተልኳል!", "success");

        // Transition to Step 2
        resetStep1.classList.remove("active");
        resetStep2.classList.add("active");

        const otpInput = document.getElementById("resetOtp");
        if (data.otpDemo) {
          // Demo fallback
          otpInput.value = data.otpDemo;
          document.getElementById("resetNewPassword").focus();
        } else {
          // Real live email delivery!
          otpInput.value = "";
          otpInput.placeholder = "Enter 6-digit code from Gmail";
          otpInput.focus();
        }

        setupToggleButtons();
        if (window.lucide) lucide.createIcons();
      } else {
        showToast(data.message || "Failed to send OTP.", "error");
      }
    } catch (err) {
      showToast("ሰርቨሩ አልተገናኘም! እባክዎ ሰርቨሩን ያብሩት።", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Send OTP Code";
    }
  });

  // Back to Step 1
  backToStep1.addEventListener("click", function () {
    resetStep2.classList.remove("active");
    resetStep1.classList.add("active");
  });

  // Step 2: Verify OTP & Change Password
  verifyOtpForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const otp = document.getElementById("resetOtp").value.trim();
    const newPassword = document.getElementById("resetNewPassword").value;
    const btn = verifyOtpForm.querySelector('button[type="submit"]');

    if (newPassword.length < 8) {
      showToast("አዲሱ የይለፍ ቃል ቢያንስ 8 ፊደላት መሆን አለበት!", "error");
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = "Updating...";

      const res = await fetch(`${API_BASE_URL}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: currentResetEmail,
          otp,
          newPassword,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(data.message || "የይለፍ ቃልዎ በተሳካ ሁኔታ ተቀይሯል!", "success");
        verifyOtpForm.reset();
        closeModal();
        openLogin();
      } else {
        showToast(data.message || "የተሳሳተ OTP ኮድ!", "error");
      }
    } catch (err) {
      showToast("ሰርቨሩ አልተገናኘም! እባክዎ ሰርቨሩን ያብሩት።", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Change Password";
    }
  });
}
