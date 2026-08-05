/* ActiScan — main.js */

// ── Flash messages auto-dismiss ───────────────────────────────────────────────
document.querySelectorAll(".flash-close").forEach(btn => {
  btn.addEventListener("click", () => btn.closest(".flash-item").remove());
});
setTimeout(() => {
  document.querySelectorAll(".flash-item").forEach(el => {
    el.style.transition = "opacity .4s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 400);
  });
}, 5000);

// ── Sidebar toggle (mobile) ────────────────────────────────────────────────────
const hamburger = document.getElementById("hamburger");
const sidebar   = document.getElementById("sidebar");
const overlay   = document.getElementById("sidebarOverlay");

if (hamburger && sidebar) {
  hamburger.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    if (overlay) overlay.classList.toggle("active");
  });
}
if (overlay) {
  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  });
}

// ── Active sidebar link ────────────────────────────────────────────────────────
const currentPath = window.location.pathname;
document.querySelectorAll(".sidebar-nav a").forEach(link => {
  const href = link.getAttribute("href");
  if (href && currentPath.startsWith(href) && href !== "/") {
    link.classList.add("active");
  }
});

// ── Password visibility toggle ─────────────────────────────────────────────────
document.querySelectorAll(".password-toggle").forEach(btn => {
  btn.addEventListener("click", () => {
    const input = btn.previousElementSibling || btn.parentElement.querySelector("input");
    if (!input) return;
    const isText = input.type === "text";
    input.type = isText ? "password" : "text";
    const icon = btn.querySelector("i");
    if (icon) {
      icon.className = isText ? "bi bi-eye" : "bi bi-eye-slash";
    }
  });
});

// ── Anti double-submit ─────────────────────────────────────────────────────────
document.querySelectorAll("form[data-no-double-submit]").forEach(form => {
  form.addEventListener("submit", function(e) {
    const btn = form.querySelector("button[type=submit]");
    if (btn && btn.disabled) { e.preventDefault(); return; }
    if (btn) {
      btn.disabled = true;
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Procesando…';
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText;
      }, 8000);
    }
  });
});

// ── Confirm dialogs ────────────────────────────────────────────────────────────
document.querySelectorAll("[data-confirm]").forEach(el => {
  el.addEventListener("click", function(e) {
    const msg = this.dataset.confirm || "¿Estás seguro de esta acción?";
    if (!confirm(msg)) e.preventDefault();
  });
});

// ── Modal helpers ──────────────────────────────────────────────────────────────
window.openModal = function(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add("active");
};
window.closeModal = function(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("active");
};
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", function(e) {
    if (e.target === this) this.classList.remove("active");
  });
});
document.querySelectorAll(".modal-close").forEach(btn => {
  btn.addEventListener("click", () => {
    const m = btn.closest(".modal-overlay");
    if (m) m.classList.remove("active");
  });
});

// ── Return item modal: set item id ────────────────────────────────────────────
document.querySelectorAll("[data-return-item]").forEach(btn => {
  btn.addEventListener("click", function() {
    const form = document.getElementById("returnForm");
    if (form) {
      const parts = form.action.split("/items/");
      form.action = parts[0] + "/items/" + this.dataset.returnItem + "/return";
    }
    openModal("returnModal");
  });
});

// ── Cancel audit modal ─────────────────────────────────────────────────────────
document.querySelectorAll("[data-cancel-audit]").forEach(btn => {
  btn.addEventListener("click", function() {
    openModal("cancelModal");
  });
});
