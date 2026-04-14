const express = require("express");
require("dotenv").config();

const Stripe = require("stripe");
const cors = require("cors");
const path = require("path");

const app = express();

/* PRODUCTS */
const PRODUCTS = require("./products.js");

/* ENV */
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL;

/* STRIPE */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* MIDDLEWARE */
app.use(express.json());
app.use(cors({ origin: true }));

/* STATIC (VIIMEISTEN API-ROUTEJEN JÄLKEEN) */
app.use(express.static(path.join(__dirname, "../public")));

/* API ROUTES */
app.get("/products", (req, res) => {
  console.log("PRODUCTS HIT");
  res.json(PRODUCTS);
});

app.post("/pay", async (req, res) => {

  console.log("PAY ROUTE HIT");
console.log("BODY:", req.body);
console.log("STRIPE KEY:", process.env.STRIPE_SECRET_KEY ? "OK" : "MISSING");

  try {
    const { cart, shipping } = req.body;

    const shippingCost = shipping === "delivery" ? 5.99 : 0;

    const line_items = cart.map(item => {
      const product = PRODUCTS[item.id];
      if (!product) throw new Error("Product not found");

      return {
        price_data: {
          currency: "eur",
          product_data: { name: product.name },
          unit_amount: Math.round(product.price * 100)
        },
        quantity: item.quantity
      };
    });

    if (shippingCost > 0) {
      line_items.push({
        price_data: {
          currency: "eur",
          product_data: { name: "Kuljetus" },
          unit_amount: Math.round(shippingCost * 100)
        },
        quantity: 1
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items,
      success_url: `${BASE_URL}/success.html`,
      cancel_url: `${BASE_URL}/cancel.html`
    });

    return res.json({ url: session.url });

  } catch (err) {
    console.error("PAY ERROR:", err);
    return res.status(500).json({ error: "Stripe error" });
  }
});

/* FALLBACK VIIMEISENÄ */
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log("Serveri käynnissä portissa", PORT);
});