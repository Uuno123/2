document.addEventListener("DOMContentLoaded", () => {

  console.log("MENU JS LATAUTUI");

  /* =========================
     PRODUCTS (FROM BACKEND)
  ========================= */
  window.PRODUCTS = {};
  window.PRODUCTS_READY = false;

  async function loadProducts() {
    try {
      const res = await fetch("https://paradize-pizzeria.onrender.com/products");
      window.PRODUCTS = await res.json();
      window.PRODUCTS_READY = true;

      console.log("PRODUCTS LADATTU:", window.PRODUCTS);

      // ENABLE ALL ADD BUTTONS WHEN READY (optional but good UX)
      document.querySelectorAll(".add-btn").forEach(btn => {
        btn.disabled = false;
      });

    } catch (err) {
      console.error("PRODUCTS LOAD ERROR:", err);
    }
  }

  loadProducts();

  /* =========================
     HAMBURGER MENU
  ========================= */
  const btn = document.getElementById("hamburgerBtn");
  const menu = document.getElementById("slideMenu");
  const overlay = document.getElementById("overlay");

  function toggleMenu() {
    const open = menu.classList.toggle("open");
    if (btn) btn.classList.toggle("open", open);
    if (overlay) overlay.classList.toggle("open", open);
  }

  if (btn && menu && overlay) {
    btn.addEventListener("click", toggleMenu);
    overlay.addEventListener("click", toggleMenu);
  }

  /* =========================
     CART
  ========================= */
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
  }

  /* =========================
     ADD TO CART
  ========================= */
  window.addToCart = function (id) {

    console.log("ADD TO CART:", id);

    if (!window.PRODUCTS_READY || !window.PRODUCTS[id]) {
      console.error("Tuotteet ei vielä valmiina tai id väärä:", id);
      return;
    }

    const product = window.PRODUCTS[id];

    const existing = cart.find(item => item.id === id);

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: id,
        quantity: 1
      });
    }

    saveCart();
    updateCartCount();

    showAlert(product.name + " lisätty koriin!");
  };

  /* =========================
     CART COUNT
  ========================= */
  function updateCartCount() {
    const cartCounts = document.querySelectorAll(".cart-count");

    const total = cart.reduce((sum, item) => sum + item.quantity, 0);

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
     REMOVE FROM CART
  ========================= */
  window.removeFromCart = function (id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    updateCartCount();
  };

  /* =========================
     DECREASE QUANTITY
  ========================= */
  window.decreaseQty = function (id) {
    const item = cart.find(i => i.id === id);

    if (!item) return;

    item.quantity--;

    if (item.quantity <= 0) {
      cart = cart.filter(i => i.id !== id);
    }

    saveCart();
    updateCartCount();
  };

  /* =========================
     ALERT
  ========================= */
  function showAlert(message) {
    const alertBox = document.getElementById("custom-alert");
    const alertText = document.getElementById("alert-text");

    if (!alertBox || !alertText) return;

    alertText.textContent = message;
    alertBox.classList.add("show");

    setTimeout(() => {
      alertBox.classList.remove("show");
    }, 2000);
  }

  /* =========================
     INIT
  ========================= */
  updateCartCount();

});