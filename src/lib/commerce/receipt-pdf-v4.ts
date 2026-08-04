import { Buffer } from "node:buffer";

export type ReceiptItem = { name: string; variant: string | null; quantity: number; lineTotalIdr: number };
export type PaymentReceipt = {
  orderNumber: string; customerName: string; email: string; whatsapp: string; address: string;
  city: string; province: string; postalCode: string; subtotalIdr: number; shippingCostIdr: number;
  totalIdr: number; paidAt: string; items: ReceiptItem[];
};

const PAGE_WIDTH = 298;
const PAGE_HEIGHT = 420;
const LEFT = 22;
const RIGHT = PAGE_WIDTH - 22;
const LOGO_MASK_BASE64 = "eNrt2j1u5DYYBmAJKljqAgF0hFwgAK+VIgDVuQngI2SPosABptwryHCRVrNptABB7oyon++PIqm4XDWGx8NHGup7KZLjqvp5wKP13n/x+JjWv6nlN/z+8Ab97r1dfm9w03dCeQepnlOjvm+UwS3/ppQfwRkHKNUrNa+UIg3fvHxZArW+pK0JlCYNXxgV2tfgChHVa6cDRdspTs2gjyGlMNXQdq2PfMIY9fhc3ULRlq7jVLhv5rhAUDsL9bpQtKusFqhx71REdeGStb8tlMmh5p2yjLKPP7wtr7NWRqAsuAZw6I36eL6D9fokSAHg1Np72t+flMqiln5vWQhNuKfaz0+K3fp3kRrEEPqNssauV32em+0WRqhxo3QeNUkh3KJkvNOW14IUwbUaakpt9uNyOolqRcpKeV7T/KReLS+rE4qFUB3Ui13PlIrgWk4ytfT3TaDE3KzlRPPcrid5NPmwvNjPKBrCrfwfp7gLlBjBtZxEKty67zY3N6EGaAj1Qc0C9X5CtYTa+u7x0/6RG0FAeZbm50/3G6feIpQUQn9Q/hdO3UqpMUq9RCghz3smn9SffIxpTygSwgZS/zAqkpsTqg/UmE/NPIQKUzozN4EyiNprw6zDcl5uADXTNC8vz/mU5XnuIGUZFYsgeKhammZIzafz0zr2fN7bAqo/n+seHwuH0GDK8FmvOG0O1yJQE6JcglI7hUO4F+xB2QTV7FQDqfoCVRNqIGkG1JxaY+wUCmHzv6iKU30ZZcRJskLPx2IKhrC9Quk45S5TMM9HIPOLAVAwz/oTKEfSDOLs8ikYQiNQPp9SlJqqokGGUT0pV0CN2VQjrjTFAXkopYaD6oTJ3Um1g0tp8EKRU9M5VRVQLoeayM0MVCsu3qODDCimNklNZ6MoLHEwm4xQNoOij9dAKZ/urIYOB44MEhFKKP0WUC2mZkA1Pt3vHaU8mSDFqFGshY1Scar2yVvYekb1+OETo2ZhlX+M2nsIa0ZV0kTqhKoxNUDKCNWQpEY8fVgpLaz8TqjqE6iJTKro0CxtWTzOlKRmvKBbqTaTGskEVKCUUO5JyuIIrFRdSHXHKp5SldBIRVapZENgv60GzN9LKY+XOxvV8XulYnuQIIQSpfIougiEHWjQ/k8hNaANKIOWUynKkQWzTCmWtjQ1osWA8ZH9dpGyZHOhgZ8azPcyqJlseagIhRdGIjWRjRi0PSNRtY880cDDQ+dRVZQayKMMLX1FKvacBQ/akGe0UC6j6Jo1TekI5ei2o6YjazY1U6qD96KImugW7etlim0cf4WvFlFsB+N2lbLsK7N/YYWUUCOjPujeRW5d8enW/SI18S2a77DY8jPoqt8ZNcPW0ZHhGGS2LlLCV0opqgEUvFbHv+gyIAKxaS2hfmX9vue5lNJsMr/neSqkugjVgWqLDk0Tolq2Lghn/+sqNVbC0DAUUooV6Z7nHlNtimp4vW95TlMjomrPdk63PFeXKMvy/F85VXn5G9Q7eE1e0R/TWnQNXsizLaY0o9Y8Z1C9RPVsAWzmYqpj5R7ybKZiipd72FPWlNI+tvLC1MTzPCYpRyienDXP5VTDyj1U7euQpCyheLmHV772hDLRFT1u6FgIb2lqIlTl5W/5P6pyysjUtzQ1UoqXuyb3NFDiXFiiBpbnNFVRqmPl3uVRjlE8OW0eZRml5OTQvpL3nCRqpskZk9TIqIaVe0PuQ4TqGVXL09E+RR1fbZGcsP+PoXPFRlw2SBR9ULgkNQiUYeXe4Q8sUrYSKF7uCheHSPUSxR8UdWyT/8Kh3WdJVf1pF/XzSBw/ACGrG5c=";

function safe(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[^\x20-\x7E]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function rupiah(v: number) { return `Rp${Math.round(v).toLocaleString("id-ID")}`; }
function paidAt(v: string) { return `${new Intl.DateTimeFormat("en-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(v))} WIB`; }
function short(v: string, m: number) { return v.length <= m ? v : `${v.slice(0, m - 3)}...`; }

export function buildPaymentReceiptPdf(receipt: PaymentReceipt) {
  const commands: string[] = [];
  const logo = Buffer.from(LOGO_MASK_BASE64, "base64");
  const text = (x:number,y:number,size:number,value:string,font:"F1"|"F2"="F1",gray=0)=>commands.push(`${gray} g BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${safe(value)}) Tj ET`);
  const line=(y:number,gray=.82,width=.5)=>commands.push(`${gray} G ${width} w ${LEFT} ${y} m ${RIGHT} ${y} l S`);
  const rect=(x:number,y:number,w:number,h:number,gray:number)=>commands.push(`${gray} g ${x} ${y} ${w} ${h} re f`);

  rect(0,0,PAGE_WIDTH,PAGE_HEIGHT,.965); rect(0,326,PAGE_WIDTH,94,0);
  commands.push("q 1 g 118 0 0 28.7 22 374 cm /Im1 Do Q");
  text(LEFT,348,5.5,"PAYMENT RECEIPT","F2",.62); text(LEFT,334,8,short(receipt.orderNumber,40),"F2",1);
  rect(232,382,44,17,1); text(245,388,6,"PAID","F2",0);
  text(LEFT,304,5.5,"TOTAL PAID","F2",.5); text(LEFT,279,22,rupiah(receipt.totalIdr),"F2",.02); text(LEFT,263,6,paidAt(receipt.paidAt),"F1",.42);
  rect(LEFT,204,RIGHT-LEFT,45,1); text(34,235,5.5,"CUSTOMER","F2",.5); text(34,220,8,short(receipt.customerName,36),"F2",.04);
  text(34,208,6,short(receipt.email||receipt.whatsapp,44),"F1",.38); text(174,220,6,short(`${receipt.city}, ${receipt.province}`,28),"F1",.25); text(174,208,6,receipt.postalCode,"F1",.5);
  text(LEFT,185,5.5,"ORDER DETAILS","F2",.48); text(226,185,5.5,"AMOUNT","F2",.48); line(179,.76,.6);
  let y=165; for (const item of receipt.items.slice(0,5)) { const name=item.variant?`${item.name} - ${item.variant}`:item.name; text(LEFT,y,7,short(name,34),"F2",.08); text(LEFT,y-10,5.5,`Quantity ${item.quantity}`,"F1",.5); text(226,y,7,rupiah(item.lineTotalIdr),"F2",.08); y-=26; }
  const totalsY=Math.max(72,y+5); line(totalsY,.76,.6); text(166,totalsY-15,6,"Subtotal","F1",.42); text(226,totalsY-15,6,rupiah(receipt.subtotalIdr),"F1",.15); text(166,totalsY-28,6,"Shipping","F1",.42); text(226,totalsY-28,6,rupiah(receipt.shippingCostIdr),"F1",.15);
  rect(0,0,PAGE_WIDTH,50,0); text(LEFT,29,8,"Thank you.","F2",1); text(LEFT,16,6.5,"Carry Your Build.","F1",.7); text(190,17,5,"visr.works","F2",.7); text(190,8,4.5,"Payment receipt - not a tax invoice","F1",.52);

  const stream=commands.join("\n");
  const objects:Array<string|Buffer>=[
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im1 7 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream,"latin1")} >>\nstream\n${stream}\nendstream`,
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 600 /Height 146 /ImageMask true /BitsPerComponent 1 /Decode [1 0] /Filter /FlateDecode /Length ${logo.length} >>\nstream\n`,"latin1"),logo,Buffer.from("\nendstream","latin1")]),
  ];
  const parts:Buffer[]=[Buffer.from("%PDF-1.4\n%VISR\n","latin1")]; const offsets=[0]; let length=parts[0].length;
  objects.forEach((object,index)=>{ offsets.push(length); const head=Buffer.from(`${index+1} 0 obj\n`,"latin1"); const body=Buffer.isBuffer(object)?object:Buffer.from(object,"latin1"); const tail=Buffer.from("\nendobj\n","latin1"); parts.push(head,body,tail); length+=head.length+body.length+tail.length; });
  const xrefOffset=length; let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`; for(let i=1;i<offsets.length;i++) xref+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`; xref+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`; parts.push(Buffer.from(xref,"latin1"));
  return Buffer.concat(parts);
}
