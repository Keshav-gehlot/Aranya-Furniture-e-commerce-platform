// Minimal stand-in for Razorpay's REST API, used only by the E2E run.
import http from "http";

const orders = new Map();
const payments = new Map();

export function startMockRazorpay(port = 4010) {
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const json = body ? JSON.parse(body) : {};
    const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (!req.headers.authorization?.startsWith("Basic ")) return send(401, { error: "auth" });
    if (req.method === "POST" && req.url === "/v1/orders") {
      const id = `order_${Math.random().toString(36).slice(2, 12)}`;
      orders.set(id, { id, amount: json.amount, currency: json.currency });
      return send(200, orders.get(id));
    }
    const m = req.url.match(/^\/v1\/payments\/([^/]+)(\/capture|\/refund)?$/);
    if (m) {
      const p = payments.get(m[1]);
      if (!p) return send(404, { error: "no payment" });
      if (m[2] === "/capture") p.status = "captured";
      if (m[2] === "/refund") { p.amount_refunded = (p.amount_refunded || 0) + json.amount; return send(200, { id: "rfnd_1", amount: json.amount }); }
      return send(200, p);
    }
    send(404, { error: "not mocked" });
  });
  server.listen(port);
  return {
    server,
    /** Simulates the customer completing payment in Razorpay's window. */
    pay(orderId, paymentId, status = "captured") {
      const o = orders.get(orderId);
      payments.set(paymentId, { id: paymentId, order_id: orderId, amount: o.amount, currency: "INR", status });
    },
  };
}
