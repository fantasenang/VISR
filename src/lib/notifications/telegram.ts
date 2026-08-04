type TelegramOrderItem = {
  name: string;
  variantName: string | null;
  quantity: number;
};

type TelegramPaidOrder = {
  orderNumber: string;
  customerName: string;
  totalIdr: number;
  courier: string | null;
  service: string | null;
  items: TelegramOrderItem[];
};

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function controlUrl() {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://visr.works").replace(/\/$/, "");
  return `${base}/visr-control`;
}

export async function sendTelegramPaidOrder(order: TelegramPaidOrder) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) return { sent: false as const, reason: "not_configured" as const };

  const itemLines = order.items.length
    ? order.items.map((item) => `• ${escapeHtml(item.variantName || item.name)} ×${item.quantity}`).join("\n")
    : "• Item details unavailable";
  const courier = [order.courier, order.service].filter(Boolean).join(" ") || "Not selected";

  const text = [
    "<b>🔔 NEW VISR PAID ORDER</b>",
    "",
    `<b>Order</b>\n<code>${escapeHtml(order.orderNumber)}</code>`,
    "",
    `<b>Customer</b>\n${escapeHtml(order.customerName)}`,
    "",
    `<b>Items</b>\n${itemLines}`,
    "",
    `<b>Total</b>\n${escapeHtml(rupiah(order.totalIdr))}`,
    "",
    `<b>Courier</b>\n${escapeHtml(courier)}`,
    "",
    "✅ Payment verified — action required",
  ].join("\n");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{ text: "📦 Open VISR Control", url: controlUrl() }]],
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const failure = await response.text().catch(() => "");
    throw new Error(`TELEGRAM_SEND_FAILED:${response.status}:${failure.slice(0, 300)}`);
  }

  return { sent: true as const };
}
