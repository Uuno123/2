function scrollToSection() {
  document.getElementById("container3").scrollIntoView({
    behavior: "smooth"
  });
}

/* =========================
   HAMBURGER MENU
========================= */
const btn = document.getElementById('hamburgerBtn');
const menu = document.getElementById('slideMenu');
const overlay = document.getElementById('overlay');

function toggle() {
  const open = menu.classList.toggle('open');
  btn.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
}

if (btn && menu && overlay) {
  btn.addEventListener('click', toggle);
  overlay.addEventListener('click', toggle);
}

/* =========================
   CART COUNT (SAFE)
========================= */
function getCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("cart"));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function updateCartCount() {
  const cart = getCart();
  const cartCounts = document.querySelectorAll(".cart-count");

  const total = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);

  cartCounts.forEach(el => {
    if (total > 0) {
      el.style.display = "block";
      el.textContent = total;
    } else {
      el.style.display = "none";
    }
  });
}

/* =========================
   AUTO UPDATE
========================= */
document.addEventListener("DOMContentLoaded", updateCartCount);

/* IMPORTANT: sync when user comes back */
window.addEventListener("pageshow", updateCartCount);

/* =========================
   INIT
========================= */
renderCart();
updateCartCount(); // ✅ LISÄÄ TÄMÄ