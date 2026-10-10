const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const switchButton = document.querySelector("#switch-button");
const switchLabel = document.querySelector("#switch-label");
const title = document.querySelector("#form-title");
const intro = document.querySelector("#form-intro");

// --- NEW: Select all password toggle buttons ---
const togglePasswordButtons = document.querySelectorAll(".toggle-password");

function showForm(formToShow) {
  const isSignup = formToShow === signupForm;
  loginForm.hidden = isSignup;
  signupForm.hidden = !isSignup;
  title.textContent = isSignup ? "Create your account" : "Welcome back";
  intro.textContent = isSignup
    ? "Fill in your details to create a new account."
    : "Enter your details to sign in to your account.";
  switchLabel.textContent = isSignup ? "Already have an account?" : "Don't have an account?";
  switchButton.textContent = isSignup ? "Log in" : "Sign up";
  switchButton.setAttribute("aria-controls", isSignup ? "login-form" : "signup-form");

  clearFormState(loginForm);
  clearFormState(signupForm);
  
  // --- NEW: Reset all password inputs back to hidden text when switching forms ---
  document.querySelectorAll("input[data-password-input]").forEach(input => {
    input.type = "password";
  });
  togglePasswordButtons.forEach(btn => {
    btn.textContent = "👁️";
    btn.setAttribute("aria-label", "Show password");
  });

  formToShow.querySelector("input").focus();
}

function clearFormState(form) {
  form.querySelectorAll(".error").forEach((error) => {
    error.textContent = "";
  });
  form.querySelectorAll("input").forEach((input) => {
    input.removeAttribute("aria-invalid");
  });
  form.querySelector(".form-message").textContent = "";
}

function setError(input, message) {
  const error = document.querySelector(`#${input.id}-error`);
  input.setAttribute("aria-invalid", "true");
  error.textContent = message;
}

function validateForm(form) {
  clearFormState(form);
  let isValid = true;
  let firstInvalidInput;

  const requiredInputs = form.querySelectorAll("input[required]");
  requiredInputs.forEach((input) => {
    let message = "";

    if (!input.value.trim()) {
      message = "This field is required.";
    } else if (input.type === "email" || (input.getAttribute("data-type") === "email" && !input.validity.valid)) {
      // Adjusted slightly to handle cases where input type changes to "text" dynamically
      message = "Enter a valid email address.";
    } else if (input.hasAttribute("data-password-input") && input.value.length < 8) {
      message = "Password must be at least 8 characters.";
    } else if (input.name === "name" && input.value.trim().length < 2) {
      message = "Name must be at least 2 characters.";
    }

    if (!message && input.name === "confirmPassword" &&
        input.value !== form.elements.password.value) {
      message = "Passwords do not match.";
    }

    if (message) {
      setError(input, message);
      firstInvalidInput ||= input;
      isValid = false;
    }
  });

  if (firstInvalidInput) {
    firstInvalidInput.focus();
  }
  return isValid;
}

switchButton.addEventListener("click", () => {
  showForm(signupForm.hidden ? signupForm : loginForm);
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (validateForm(loginForm)) {
    loginForm.querySelector(".form-message").textContent =
      "Form is valid. Connect this form to your sign-in service.";
  }
});

signupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (validateForm(signupForm)) {
    signupForm.querySelector(".form-message").textContent =
      "Form is valid. Connect this form to your account creation service.";
  }
});

document.querySelectorAll("form input").forEach((input) => {
  input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") === "true") {
      input.removeAttribute("aria-invalid");
      document.querySelector(`#${input.id}-error`).textContent = "";
    }
  });
});

// --- NEW: Toggle Password Logic ---
togglePasswordButtons.forEach((button) => {
  button.addEventListener("click", () => {
    // Find the closest wrapper container, then find the input inside it
    const passwordInput = button.parentElement.querySelector("input");
    
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      button.textContent = "🙈"; // Icon changes to monkey or crossed eye when visible
      button.setAttribute("aria-label", "Hide password");
    } else {
      passwordInput.type = "password";
      button.textContent = "👁️"; 
      button.setAttribute("aria-label", "Show password");
    }
  });
});
