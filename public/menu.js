let cart = [];
let PRODUCTS = {};

let currentSheetId = null;
let selectedExtras = [];
let selectedSauces = [];
let productsReady = false;

console.log("INIT PRODUCTS KEYS:", Object.keys(PRODUCTS));

function scrollToSection(sectionId) {
  const element = document.getElementById(sectionId);
  if (element) {
    const yOffset = element.getBoundingClientRect().top + window.pageYOffset;
    
    window.scrollTo({
      top: yOffset,
      left: 0, // Pakottaa nollaksi, estää sivuttaisliikkeen
      behavior: 'smooth'
    });
  }
}

/* =========================
   LOAD CART
========================= */
try {
  const saved = JSON.parse(localStorage.getItem("cart"));
  cart = Array.isArray(saved) ? saved : [];
} catch {
  cart = [];
}

/* =========================
   LOAD PRODUCTS
========================= */
async function loadProducts() {
  try {
    const res = await fetch("https://paradize-pizzeria.onrender.com/products");
    PRODUCTS = await res.json();

    console.log("PRODUCTS LOADED:", PRODUCTS);

    productsReady = true;

    renderCart();
    updateCartCount();

  } catch (err) {
    console.error("PRODUCTS ERROR:", err);
  }
}

loadProducts();

/* =========================
   ELEMENTS
========================= */
const sheet = document.getElementById("sheet");
const sheetName = document.getElementById("sheetName");
const sheetSauces = document.getElementById("sheetSauces");
const sheetExtras = document.getElementById("sheetExtras");

const cartContainer = document.getElementById("cart-items");
const summaryContainer = document.querySelector(".order-items");
const totalPriceEl = document.getElementById("summary-total-price");

/* =========================
   HAMBURGER MENU
========================= */
const btn = document.getElementById('hamburgerBtn');
const menu = document.getElementById('slideMenu');
const overlay = document.getElementById('overlay');

function toggleMenu() {
  if (!menu || !btn || !overlay) return;

  const open = menu.classList.toggle('open');
  btn.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
}

if (btn && menu && overlay) {
  btn.addEventListener('click', toggleMenu);
  overlay.addEventListener('click', toggleMenu);
}

/* =========================
   OPEN SHEET
========================= */
window.openSheet = function(id) {

  if (!productsReady) {
    console.warn("PRODUCTS NOT READY YET");
    return;
  }

  console.log("ID:", id);
  console.log("PRODUCT:", PRODUCTS[id]);

  const product = PRODUCTS[id];

  if (!product) {
    console.warn("PRODUCT NOT FOUND:", id);
    return;
  }

  currentSheetId = id;

  selectedExtras = [];
  selectedSauces = [];

  sheetName.textContent = product.name;

  document.getElementById("sheetImage").src = product.image;

  /* ===== SAUCES ===== */
  let saucesHTML = "<h3>Kastikkeet</h3>";

  if (product.sauces?.length) {
    product.sauces.forEach((s, i) => {
      saucesHTML += `
        <label>
          <input type="checkbox" data-index="${i}">
          ${s}
        </label><br>
      `;
    });
  } else {
    saucesHTML += "<p>Ei kastikkeita</p>";
  }

  sheetSauces.innerHTML = saucesHTML;

  /* ===== EXTRAS ===== */
  let extrasHTML = "<h3>Lisätäytteet</h3>";

  if (product.extras?.length) {
    product.extras.forEach((e, i) => {
      extrasHTML += `
        <label>
          <input type="checkbox" data-index="${i}">
          ${e.name} (+${e.price}€)
        </label><br>
      `;
    });
  } else {
    extrasHTML += "<p>Ei lisätäytteitä</p>";
  }

  sheetExtras.innerHTML = extrasHTML;

  /* AVAA SHEET */
  sheet.classList.add("active");

  /* NÄYTÄ OVERLAY */
  document.querySelector(".overlay2").classList.add("active");

  requestAnimationFrame(() => {
    attachSheetEvents();
  });
};

/* =========================
   CLOSE SHEET
========================= */
window.closeSheet = function() {

  if (sheet) sheet.classList.remove("active");

  /* PIILOTA OVERLAY */
  document.querySelector(".overlay2").classList.remove("active");
};

/* =========================
   SHEET EVENTS
========================= */
function attachSheetEvents() {

  const product = PRODUCTS[currentSheetId];
  if (!product) return;

  document.querySelectorAll("#sheetSauces input").forEach(cb => {
    cb.onchange = () => {
      const s = product.sauces?.[cb.dataset.index];
      if (!s) return;

      if (cb.checked) selectedSauces.push(s);
      else selectedSauces = selectedSauces.filter(x => x !== s);
    };
  });

  document.querySelectorAll("#sheetExtras input").forEach(cb => {
    cb.onchange = () => {
      const e = product.extras?.[cb.dataset.index];
      if (!e) return;

      if (cb.checked) selectedExtras.push(e);
      else selectedExtras = selectedExtras.filter(x => x.name !== e.name);
    };
  });
}

/* =========================
   ADD TO CART
========================= */
window.addToCart = function(id) {
  openSheet(id);
};

window.addToCartFinal = function() {

  const product = PRODUCTS[currentSheetId];
  if (!product) return;

  const extraPrice = selectedExtras.reduce((sum, e) => sum + e.price, 0);

  const existing = cart.find(i => {

  const sameProduct =
    i.id === currentSheetId;

  const sameExtras =
    JSON.stringify(i.extras) ===
    JSON.stringify(selectedExtras);

  return sameProduct && sameExtras;
});

  if (existing) {
    existing.quantity += 1;
  } else {
   cart.push({
  id: currentSheetId,
  quantity: 1,

  extras: [...selectedExtras],
  sauces: [...selectedSauces],

  extraPrice
});
  }

  saveCart();
  renderCart();
  updateCartCount();

  showAlert(product.name + " lisätty koriin!");

  closeSheet();
};

/* =========================
   CART RENDER
========================= */
function renderCart() {

  if (!productsReady) return;
  if (!cartContainer || !summaryContainer) return;

  cartContainer.innerHTML = "";
  summaryContainer.innerHTML = "";

  let total = 0;

  cart.forEach((item, index) => {

    const product = PRODUCTS[item.id];
    if (!product) return;

    const itemTotal =
      (product.price + (item.extraPrice || 0)) * item.quantity;

    total += itemTotal;

    const div = document.createElement("div");
    div.className = "cart-item";

    let extrasHTML = "";

if (item.extras?.length) {

  item.extras.forEach(extra => {

    extrasHTML += `
      <div class="cart-extra">
        + ${extra.name} (${extra.price}€)
      </div>
    `;
  });
}

div.innerHTML = `
  <div>
    <strong>${product.name}</strong><br>

    ${extrasHTML}

    ${item.quantity} kpl
  </div>

  <div>${itemTotal.toFixed(2)} €</div>

  <div>
    <button onclick="changeQty(${index}, -1)">-</button>
    <button onclick="changeQty(${index}, 1)">+</button>
    <button onclick="removeItem(${index})">x</button>
  </div>
`;

    cartContainer.appendChild(div);
  });

  const shipping = getShippingCost();
  total += shipping;

  summaryContainer.innerHTML = `
    <div>Kuljetus: ${shipping.toFixed(2)} €</div>
  `;

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

/* =========================
   CART COUNT
========================= */
function updateCartCount() {
  const cartCounts = document.querySelectorAll(".cart-count");

  const total = cart.reduce((sum, item) => sum + item.quantity, 0);

  cartCounts.forEach(el => {
    el.style.display = total ? "block" : "none";
    el.textContent = total;
  });
}

/* =========================
   SAVE
========================= */
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

/* =========================
   ALERT
========================= */
function showAlert(msg) {
  const box = document.getElementById("custom-alert");
  const text = document.getElementById("alert-text");

  if (!box || !text) return;

  text.textContent = msg;
  box.classList.add("show");

  setTimeout(() => box.classList.remove("show"), 2000);
}

/* =========================
   INIT
========================= */
renderCart();
updateCartCount();