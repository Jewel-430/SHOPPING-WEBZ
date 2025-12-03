// ===== American Express Shop & Shipping Shared Cart Logic =====

// Utility
const API_BASE = (() => {
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:3000";
  }
  return "https://your-backend.onrender.com";
})();

const $ = id => document.getElementById(id);

/* ============================
   CART FUNCTIONS
============================ */

function getCart() {
  try {
    return JSON.parse(localStorage.getItem("ae_cart")) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem("ae_cart", JSON.stringify(cart));
  renderCartCount();
}

function renderCartCount() {
  const cart = getCart();
  const count = cart.reduce((s, item) => s + item.qty, 0);
  const el = $("cartCount");
  if (el) el.textContent = count;
}

function addToCart(id, title, price) {
  id = Number(id);
  price = Number(price);

  if (isNaN(id) || isNaN(price)) {
    return alert("Invalid product.");
  }

  const cart = getCart();
  const found = cart.find(i => i.id === id);

  if (found) found.qty++;
  else cart.push({ id, title, price, qty: 1 });

  saveCart(cart);
  alert(`${title} added to cart`);
}

function renderCart() {
  const cartView = $("cartView");
  if (!cartView) return;

  const cart = getCart();
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0).toFixed(2);

  cartView.innerHTML = `
    <div class="card">
      <h2>Your Cart</h2>
      ${
        cart.length
          ? `
            <table id="cartTable">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
            <div class="cart-summary">
              <strong>Total: $${total}</strong>
            </div>`
          : `<p class="small">Your cart is empty.</p>`
      }
    </div>
  `;

  const tbody = document.querySelector("#cartTable tbody");
  if (!tbody) return;

  cart.forEach(item => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.title}</td>
      <td>${item.qty}</td>
      <td>$${item.price.toFixed(2)}</td>
      <td>$${(item.qty * item.price).toFixed(2)}</td>
      <td><button class="btn remove" data-id="${item.id}">Remove</button></td>
    `;
    tbody.appendChild(row);
  });

  tbody.addEventListener("click", e => {
    const btn = e.target.closest("button.remove");
    if (!btn) return;
    removeFromCart(Number(btn.dataset.id));
  });
}

function removeFromCart(id) {
  const cart = getCart().filter(i => i.id !== id);
  saveCart(cart);
  re
