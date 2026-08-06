import { QRIS_BCA_PNG_BASE64 } from "@/lib/commerce/qris-image";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode");
  const disposition = mode === "inline" ? "inline" : "attachment";
  const image = Buffer.from(QRIS_BCA_PNG_BASE64, "base64");

  return new Response(image, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(image.byteLength),
      "Content-Disposition": `${disposition}; filename="VISR-QRIS-BCA.png"`,
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
