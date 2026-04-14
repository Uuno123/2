document.addEventListener("DOMContentLoaded", () => {

  let cart = JSON.parse(localStorage.getItem("cart")) || [];
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
     LOAD PRODUCTS (IMPORTANT FIX)
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
     PAY BUTTON
  ========================= */
  const payBtn = document.querySelector(".maksa-btn");

  if (payBtn) {
    payBtn.addEventListener("click", async () => {

      const name = document.getElementById("name").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const address = document.getElementById("address").value.trim();

      const shipping = document.querySelector('input[name="shipping"]:checked')?.value || "pickup";

      if (!name || !phone) {
        alert("Täytä nimi ja puhelinnumero!");
        return;
      }

      if (shipping === "delivery" && !address) {
        alert("Anna osoite!");
        return;
      }

      if (cart.length === 0) {
        alert("Ostoskori on tyhjä!");
        return;
      }

      try {
        const res = await fetch("https://paradize-pizzeria.onrender.com/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart, shipping })
        });

        const data = await res.json();

        if (data.url) {
          window.location.href = data.url;
        } else {
          alert("Maksu epäonnistui");
        }

      } catch (err) {
        console.error(err);
        alert("Serveri ei vastaa");
      }
    });
  }

  /* =========================
     INIT
  ========================= */
  renderCart();

});