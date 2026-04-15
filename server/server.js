const express = require("express");
const Stripe = require("stripe");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();

/* =========================
   PRODUCTS (BACKEND PRICES)
========================= */
const PRODUCTS = require("./products");

/* =========================
   STRIPE
========================= */
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/* =========================
   STATIC FILES (PUBLIC OUTSIDE SERVER FOLDER)
========================= */
app.use(express.static(path.join(__dirname, "../public")));

/* =========================
   JSON BODY
========================= */
app.use(express.json());

/* =========================
   EMAIL
========================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* =========================
   ROOT ROUTE (index.html)
========================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

/* =========================
   CREATE STRIPE CHECKOUT
========================= */
app.post("/pay", async (req, res) => {
  try {
    const { cart, shipping, name, phone, address } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ error: "Cart empty" });
    }

    const shippingCost = shipping === "delivery" ? 599 : 0;

    const line_items = cart.map(item => {
      const product = PRODUCTS[item.id];

      if (!product) {
        throw new Error("Invalid product: " + item.id);
      }

      return {
        price_data: {
          currency: "eur",
          product_data: {
            name: product.name
          },
          unit_amount: Math.round(product.price * 100)
        },
        quantity: item.quantity
      };
    });

    if (shippingCost > 0) {
      line_items.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: "Delivery fee"
          },
          unit_amount: shippingCost
        },
        quantity: 1
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items,

      success_url: "https://paradize-pizzeria.onrender.com/",
      cancel_url: "https://paradize-pizzeria.onrender.com/",

      metadata: {
        name,
        phone,
        address: address || "",
        shipping
      }
    });

    res.json({ url: session.url });

  } catch (err) {
    console.log("PAY ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   STRIPE WEBHOOK
========================= */
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err) {
      console.log("❌ WEBHOOK ERROR:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      try {
        console.log("✅ ORDER RECEIVED");

        const emailText = `
🍕 UUSI TILAUS

Nimi: ${session.metadata?.name || "N/A"}
Puhelin: ${session.metadata?.phone || "N/A"}
Osoite: ${session.metadata?.address || "N/A"}
Toimitus: ${session.metadata?.shipping || "pickup"}

Summa: ${(session.amount_total / 100).toFixed(2)} €

Order ID: ${session.id}
        `;

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.RESTAURANT_EMAIL || process.env.EMAIL_USER,
          subject: "🍕 UUSI TILAUS",
          text: emailText
        });

        console.log("📧 EMAIL LÄHETETTY");
      } catch (err) {
        console.log("ORDER ERROR:", err.message);
      }
    }

    res.json({ received: true });
  }
);

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});