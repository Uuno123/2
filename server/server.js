const express = require("express");
require("dotenv").config();

const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

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
app.use(express.static(path.join(__dirname, "../public")));
app.use("/pay", express.json());

/* PRODUCTS ROUTE */
app.get("/products", (req, res) => {
  res.json(PRODUCTS);
});

/* DEBUG */
app.get("/debug-products", (req, res) => {
  res.json({
    keys: Object.keys(PRODUCTS),
    sample: PRODUCTS.pizza_07
  });
});

/* STRIPE CHECKOUT */
app.post("/pay", async (req, res) => {
  try {
    const { cart, shipping, name, phone, address, email, fix } = req.body;

    if (!cart || !Array.isArray(cart)) {
      return res.status(400).json({ error: "Cart missing" });
    }

    if (!email) {
      return res.status(400).json({ error: "Email puuttuu" });
    }

    if (!address) {
      return res.status(400).json({ error: "Osoite puuttuu" });
    }

    const zip = address.match(/\b\d{5}\b/)?.[0];

    const kuopioZips = [
      "70100","70110","70120","70150","70200",
      "70300","70400","70500","70600","70700","70800","70900"
    ];

    if (!zip || !kuopioZips.includes(zip)) {
      return res.status(400).json({
        error: "Toimitamme vain Kuopion alueelle"
      });
    }

    const shippingCost = shipping === "delivery" ? 5.99 : 0;

    /* 🔒 SAFE CART BUILD (EXTRAS INCLUDED) */
    const line_items = cart.map(item => {

      if (
        !item ||
        typeof item.id !== "string" ||
        typeof item.quantity !== "number" ||
        item.quantity < 1 ||
        item.quantity > 50
      ) {
        throw new Error("Invalid cart item");
      }

      const product = PRODUCTS[item.id];

      if (!product) {
        throw new Error("Invalid product ID: " + item.id);
      }

      // base price
      let price = product.price;

      // extras included in price
      if (item.extras && Array.isArray(item.extras)) {
        for (const extra of item.extras) {
          price += extra.price;
        }
      }

      return {
        price_data: {
          currency: "eur",
          product_data: {
            name: product.name
          },
          unit_amount: Math.round(price * 100)
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
        email: email || "",
        fix: fix || "",
        cart: JSON.stringify(cart)
      }
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error("PAY ERROR:", err);
    res.status(500).json({ error: "Stripe error" });
  }
});

/* WEBHOOK */
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const meta = session.metadata || {};

    console.log("✅ MAKSU ONNISTUI!");

    let cartText = "";

    try {
      const cart = JSON.parse(meta.cart || "[]");

      cartText = cart.map(item => {
        const product = PRODUCTS[item.id];

        let text = `${product ? product.name : item.id} x ${item.quantity}`;

        // extras
        if (item.extras?.length) {
          text += "\n  Lisäosat:";
          item.extras.forEach(e => {
            text += `\n   + ${e.name} (${e.price}€)`;
          });
        }

        // sauces
        if (item.sauces?.length) {
          text += "\n  Kastikkeet:";
          item.sauces.forEach(s => {
            text += `\n   + ${s}`;
          });
        }

        return text;
      }).join("\n\n");

    } catch (e) {
      cartText = "Cart parse error";
    }

    const emailText = `
🍕 UUSI TILAUS

Nimi: ${meta.name}
Puhelin: ${meta.phone}
Osoite: ${meta.address}
Toimitus: ${meta.shipping}

Lisäpyynnöt: ${meta.fix || "-"}

Summa: ${session.amount_total / 100} €

🛒 OSTOSKORI:
${cartText}

Tilaus ID: ${session.id}
    `;

    try {
      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: process.env.RESTAURANT_EMAIL || process.env.EMAIL_USER,
        subject: "🍕 UUSI TILAUS STRIPESTA",
        text: emailText
      });

      console.log("📧 RAVINTOLA EMAIL LÄHETETTY");

    } catch (err) {
      console.log("❌ RAVINTOLA EMAIL ERROR:", err);
    }

    if (meta.email) {
      try {
        await resend.emails.send({
          from: "onboarding@resend.dev",
          to: meta.email,
          subject: "🍕 Tilauksesi on vastaanotettu",
          text: `Kiitos tilauksesta!\n\n${emailText}`
        });

        console.log("📧 ASIAKAS EMAIL LÄHETETTY");

      } catch (err) {
        console.log("❌ ASIAKAS EMAIL ERROR:", err);
      }
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