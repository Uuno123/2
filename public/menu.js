 let cart = [];

  try {
    const saved = JSON.parse(localStorage.getItem("cart"));
    cart = Array.isArray(saved) ? saved : [];
  } catch {
    cart = [];
  }

  let PRODUCTS = {};

  const cartContainer = document.getElementById("cart-items");
  const summaryContainer = document.querySelector(".order-items");
  const totalPriceEl = document.getElementById("summary-total-price");

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
     SAVE CART
  ========================= */
  function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
  }

  /* =========================
     LOAD PRODUCTS
  ========================= */
  async function loadProducts() {
    try {
      const res = await fetch("https://paradize-pizzeria.onrender.com/products");
      PRODUCTS = await res.json();

      console.log("PRODUCTS LADATTU:", PRODUCTS);

      renderCart();

    } catch (err) {
      console.error("PRODUCTS LOAD ERROR:", err);
    }
  }

  loadProducts();

  /* =========================
     RENDER CART
  ========================= */
  function renderCart() {

    if (!cartContainer || !summaryContainer) return;

    cartContainer.innerHTML = "";
    summaryContainer.innerHTML = "";

    let total = 0;

    cart.forEach((item, index) => {

      const product = PRODUCTS[item.id];
      if (!product) return;

      const itemTotal = product.price * item.quantity;
      total += itemTotal;

      const div = document.createElement("div");
      div.className = "cart-item";

      div.innerHTML = `
        <div class="item-info">
          <img src="${product.image || ''}" class="item-image" />
          <div>
            <div>${product.name}</div>
            <div>${product.price} € x ${item.quantity}</div>
          </div>
        </div>

        <div class="item-controls">
          <button onclick="changeQty(${index}, -1)">-</button>
          <button onclick="changeQty(${index}, 1)">+</button>
          <button onclick="removeItem(${index})">x</button>
        </div>
      `;

      cartContainer.appendChild(div);

      const row = document.createElement("div");
      row.innerHTML = `
        <span>${product.name}</span>
        <span>${item.quantity} kpl</span>
        <span>${itemTotal.toFixed(2)} €</span>
      `;

      summaryContainer.appendChild(row);
    });

    const shippingCost = getShippingCost();
    total += shippingCost;

    const shippingRow = document.createElement("div");
    shippingRow.innerHTML = `
      <span>Kuljetus</span>
      <span>${shippingCost.toFixed(2)} €</span>
    `;

    summaryContainer.appendChild(shippingRow);

    totalPriceEl.textContent = total.toFixed(2) + " €";

    saveCart();
  }

  /* =========================
     CART ACTIONS
  ========================= */
  window.changeQty = function(index, amount) {

    cart[index].quantity += amount;

    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
    }

    saveCart();
    renderCart();
  };

  window.removeItem = function(index) {
    cart.splice(index, 1);

    saveCart();
    renderCart();
  };

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
     SHIPPING
  ========================= */
  function getShippingCost() {
    const selected = document.querySelector('input[name="shipping"]:checked');
    return selected && selected.value === "delivery" ? 5.99 : 0;
  }

  document.querySelectorAll('input[name="shipping"]').forEach(radio => {
    radio.addEventListener("change", renderCart);
  });

  /* =========================
     ADD TO CART
  ========================= */
  window.addToCart = function (id) {

    const product = PRODUCTS[id];

    if (!product) {
      console.error("Väärä ID:", id);
      return;
    }

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
    renderCart();
    updateCartCount();

    showAlert(product.name + " lisätty koriin!");
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
  renderCart();
  updateCartCount();