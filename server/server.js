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

/* STATIC FILES */
app.use(express.static(path.join(__dirname, "../public")));

/* PRODUCTS API */
app.get("/products", (req, res) => {
  res.json(PRODUCTS);
});

/* STRIPE CHECKOUT */
app.post("/pay", express.json(), async (req, res) => {
  console.log("PAY ROUTE HIT");

  try {
    const { cart, shipping, name, phone, address } = req.body;

    if (!cart || !Array.isArray(cart)) {
      return res.status(400).json({ error: "Cart missing" });
    }

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
      cancel_url: `${BASE_URL}/cancel.html`,

      metadata: {
        name: name || "",
        phone: phone || "",
        address: address || "",
        shipping: shipping || "",
        cart: JSON.stringify(cart)
      }
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error("PAY ERROR:", err);
    res.status(500).json({ error: "Stripe error" });
  }
});

/* EMAIL SETUP */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* STRIPE WEBHOOK */
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
    case "checkout.session.completed": {
      const session = event.data.object;
      const meta = session.metadata || {};

      console.log("✅ MAKSU ONNISTUI!");

      // Parse cart
      let cartText = "";
      try {
        const cart = JSON.parse(meta.cart || "[]");
        cartText = cart.map(i => `- ${i.id} x ${i.quantity}`).join("\n");
      } catch {
        cartText = meta.cart || "";
      }

      const emailText = `
🍕 UUSI TILAUS

Nimi: ${meta.name}
Puhelin: ${meta.phone}
Osoite: ${meta.address}
Toimitus: ${meta.shipping}

Summa: ${session.amount_total / 100} €

🛒 OSTOSKORI:
${cartText}

Tilaus ID: ${session.id}
      `;

      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: "🍕 UUSI TILAUS STRIPESTA",
        text: emailText
      }, (err, info) => {
        if (err) {
          console.log("❌ Email error:", err);
        } else {
          console.log("📧 Email lähetetty:", info.response);
        }
      });

      break;
    }

    default:
      console.log("Unhandled event:", event.type);
  }

  res.json({ received: true });
});

/* FRONTEND FALLBACK */
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

/* START SERVER */
app.listen(PORT, () => {
  console.log("Serveri käynnissä portissa", PORT);
});