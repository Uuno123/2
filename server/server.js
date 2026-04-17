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

/* MIDDLEWARE (IMPORTANT ORDER) */
app.use(cors({ origin: true }));

/* STATIC FILES */
app.use(express.static(path.join(__dirname, "../public")));

/* JSON ONLY FOR NON-WEBHOOK ROUTES */
app.use("/pay", express.json());

/* PRODUCTS */
app.get("/products", (req, res) => {
  res.json(PRODUCTS);
});

/* STRIPE CHECKOUT */
app.post("/pay", async (req, res) => {
  try {
    const { cart, shipping, name, phone, address, email } = req.body;

    // 🔴 1. CART CHECK
    if (!cart || !Array.isArray(cart)) {
      return res.status(400).json({ error: "Cart missing" });
    }

    // 2,5 Email CHECK
    if (!email) {
  return res.status(400).json({ error: "Email puuttuu" });
}

    // 🔴 2. ADDRESS CHECK
    if (!address) {
      return res.status(400).json({ error: "Osoite puuttuu" });
    }

    const zip = address.match(/\b\d{5}\b/)?.[0];

    const kuopioZips = [
      "70100","70110","70120","70150","70200",
      "70300","70400","70500","70600","70700","70800","70900"
    ];

    // 🔴 3. KUOPIO CHECK (TÄRKEIN)
    if (!zip || !kuopioZips.includes(zip)) {
      return res.status(400).json({
        error: "Toimitamme vain Kuopion alueelle"
      });
    }

    // 🔥 4. SHIPPING
    const shippingCost = shipping === "delivery" ? 5.99 : 0;

    // 🔥 5. PRODUCTS → STRIPE LINE ITEMS
    const line_items = cart.map(item => {
      const product = PRODUCTS[item.id];
      if (!product) throw new Error("Product not found");

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

    // 🔥 6. SHIPPING ADD-ON
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

    // 🔥 7. STRIPE SESSION
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
        email: email || "",
        cart: JSON.stringify(cart)
      }
    });

    // 🔥 8. RETURN URL
    res.json({ url: session.url });

  } catch (err) {
    console.error("PAY ERROR:", err);
    res.status(500).json({ error: "Stripe error" });
  }
});

/* EMAIL */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* STRIPE WEBHOOK (RAW BODY IMPORTANT) */
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
    console.log("❌ WEBHOOK ERROR:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  /* HANDLE EVENT */
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const meta = session.metadata || {};

    console.log("✅ MAKSU ONNISTUI!");

    const emailText = `
🍕 UUSI TILAUS

Nimi: ${meta.name}
Puhelin: ${meta.phone}
Osoite: ${meta.address}
Toimitus: ${meta.shipping}

Summa: ${session.amount_total / 100} €

🛒 OSTOSKORI:
${meta.cart}

Tilaus ID: ${session.id}
    `;

    // 🔥 1. RAVINTOLA
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.RESTAURANT_EMAIL || process.env.EMAIL_USER,
      subject: "🍕 UUSI TILAUS STRIPESTA",
      text: emailText
    }, (err, info) => {
      if (err) {
        console.log("❌ EMAIL ERROR:", err);
      } else {
        console.log("📧 RAVINTOLA EMAIL LÄHETETTY:", info.response);
      }
    });

    // 🔥 2. ASIAKAS (TÄMÄ LISÄTTY OIKEAAN KOHTAAN)
    if (meta.email) {
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: meta.email,
        subject: "🍕 Tilauksesi on vastaanotettu",
        text: `
Kiitos tilauksesta!

${emailText}
        `
      }, (err, info) => {
        if (err) {
          console.log("❌ ASIAKAS EMAIL ERROR:", err);
        } else {
          console.log("📧 ASIAKAS EMAIL LÄHETETTY:", info.response);
        }
      });
    }
  }

  res.sendStatus(200);
});

/* FALLBACK */
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

/* START */
app.listen(PORT, () => {
  console.log("Serveri käynnissä portissa", PORT);
});