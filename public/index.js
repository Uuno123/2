function scrollToSection() {
  document.getElementById("container3").scrollIntoView({
    behavior: "smooth"
  });
}

const btn = document.getElementById('hamburgerBtn');
const menu = document.getElementById('slideMenu');
const overlay = document.getElementById('overlay');

function toggle() {
  const open = menu.classList.toggle('open');
  btn.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
}

btn.addEventListener('click', toggle);
overlay.addEventListener('click', toggle);





function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
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

document.addEventListener("DOMContentLoaded", updateCartCount);