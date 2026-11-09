import { createServer, type ServerResponse } from "node:http";
import { branches, orders } from "./store.ts";
import { assignOrder, getLoad } from "./dispatch.ts";
import { isValidDate } from "./time.ts";

const port = Number(process.env.PORT ?? 3001);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    // GET /branches
    if (req.method === "GET" && url.pathname === "/branches") {
      return send(res, 200, branches);
    }

    // GET /orders/:id
    if (req.method === "GET" && parts[0] === "orders" && parts.length === 2) {
      const order = orders.find((o) => o.id === parts[1]);
      if (!order) {
        return send(res, 404, { error: "order_not_found" });
      }
      return send(res, 200, order);
    }

    // POST /orders/:id/assign
    if (
      req.method === "POST" &&
      parts.length === 3 &&
      parts[0] === "orders" &&
      parts[2] === "assign"
    ) {
      const orderId = parts[1];
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        return send(res, 404, { error: "order_not_found" });
      }

      const result = assignOrder(order, branches);
      return send(res, 200, result);
    }

    // GET /branches/:id/load?date=2026-11-16
    if (
      req.method === "GET" &&
      parts.length === 3 &&
      parts[0] === "branches" &&
      parts[2] === "load"
    ) {
      const date = url.searchParams.get("date");
      if (date === null || !isValidDate(date)) {
        return send(res, 400, { error: "invalid_date" });
      }

      const branchId = parts[1];
      const branch = branches.find((b) => b.id === branchId);
      if (!branch) {
        return send(res, 404, { error: "branch_not_found" });
      }

      return send(res, 200, {
        branchId: branch.id,
        date: date,
        assigned: getLoad(branch.id, date),
        limit: branch.dailyLimit,
      });
    }

    send(res, 404, { error: "not_found" });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: "internal" });
  }
});

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

server.listen(port, () => {
  console.log(`dispatch: http://localhost:${port}`);
});
