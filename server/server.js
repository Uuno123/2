const express = require("express");
require("dotenv").config();

const nodemailer = require("nodemailer");
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
app.use(cors({ origin: true }));

/* STATIC (VIIMEISTEN API-ROUTEJEN JÄLKEEN) */
app.use(express.static(path.join(__dirname, "../public")));

/* API ROUTES */
app.get("/products", (req, res) => {
  console.log("PRODUCTS HIT");
  res.json(PRODUCTS);
});

app.post("/pay", express.json(), async (req, res) => {

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

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;

      console.log("✅ Payment OK:", session.id);

      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: "Uusi tilaus",
        text: `Tilaus ID: ${session.id}\nSumma: ${session.amount_total / 100} €`
      });

      break;

    default:
      console.log("Unhandled event type:", event.type);
  }

  res.json({ received: true });
});


/* FALLBACK VIIMEISENÄ */
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log("Serveri käynnissä portissa", PORT);
});