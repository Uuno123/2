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
    btn?.classList.toggle('open', open);
    overlay?.classList.toggle('open', open);
  }

  btn?.addEventListener('click', toggle);
  overlay?.addEventListener('click', toggle);

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
      renderCart();
    } catch (err) {
      console.error("PRODUCTS ERROR:", err);
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
    return selected?.value === "delivery" ? 5.99 : 0;
  }

  document.querySelectorAll('input[name="shipping"]').forEach(r => {
    r.addEventListener("change", renderCart);
  });

  /* ==========================
      OSOITE VARMISTUS
  ============================*/
  
  function isAddressValid() {
  const address = document.getElementById("address").value.toLowerCase();

  const zip = address.match(/\d{5}/)?.[0];

  const kuopioZips = [
    "70100","70110","70120","70150","70200",
    "70300","70400","70500","70600","70700","70800","70900"
  ];

  return zip && kuopioZips.includes(zip);
}


function handlePayment() {

  if (!isAddressValid()) {
    alert("Toimitamme vain Kuopion alueelle!");
    return;
  }

  stripeCheckout(); // vain jos ok
}


  /* =========================
     PAY BUTTON (IMPORTANT FIX)
  ========================= */
  const payBtn = document.querySelector(".maksa-btn");

  payBtn?.addEventListener("click", async () => {

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim()
    const phone = document.getElementById("phone").value.trim();
    const address = document.getElementById("address").value.trim();

    const shipping = document.querySelector('input[name="shipping"]:checked')?.value || "pickup";

    if (!name || !phone) {
      alert("Täytä nimi ja puhelinnumero!");
      return;
    }

    if (!email) {
      alert("Anna Gmail!")
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

        // 🔥 TÄRKEIN FIX: kaikki tiedot mukaan
        body: JSON.stringify({
          cart,
          shipping,
          name,
          phone,
          address,
          email
        })
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

  /* =========================
     INIT
  ========================= */
  renderCart();
});

function checkUIAddress() {
  const address = document.getElementById("address").value.toLowerCase();

  const zip = address.match(/\b\d{5}\b/)?.[0];

  const kuopioZips = [
    "70100","70110","70120","70150","70200",
    "70300","70400","70500","70600","70700","70800","70900"
  ];

  return zip && kuopioZips.includes(zip);
}

const addressInput = document.getElementById("address");
const payBtn = document.querySelector(".maksa-btn");

addressInput.addEventListener("input", () => {
  if (checkUIAddress()) {
    payBtn.disabled = false;
    payBtn.style.opacity = "1";
  } else {
    payBtn.disabled = true;
    payBtn.style.opacity = "0.5";
  }
});

function handlePayment() {
  if (!checkUIAddress()) {
    alert("Toimitamme vain Kuopion alueelle!");
    return;
  }

  fetch("/pay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      cart: cart,
      shipping: document.querySelector('input[name="shipping"]:checked').value,
      name: document.getElementById("name").value,
      phone: document.getElementById("phone").value,
      address: document.getElementById("address").value
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      return;
    }

    window.location.href = data.url;
  });
}