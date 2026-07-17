import type { MenuItem, TableOrder } from '../types';

// Convert an image URL into ESC/POS raster bitmap bytes (GS v 0),
// so thermal printers can print the UPI QR code, not just text.
export async function imageUrlToEscPosRaster(url: string, targetWidth: number): Promise<Uint8Array> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = url;
  });
  const w = targetWidth;
  const h = Math.round(img.height * (w / img.width));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const bytesPerRow = Math.ceil(w / 8);
  const raster = new Uint8Array(bytesPerRow * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < 128) raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x % 8);
    }
  }
  const header = new Uint8Array([0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff]);
  const out = new Uint8Array(header.length + raster.length);
  out.set(header, 0);
  out.set(raster, header.length);
  return out;
}

function mergeChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  chunks.forEach((c) => {
    out.set(c, offset);
    offset += c.length;
  });
  return out;
}

interface ReportPrintOptions {
  from: string;
  to: string;
  income: number;
  out: number;
  balance: number;
  ordersCount: number;
  hotelName: string;
}

// Build ESC/POS bytes for a report summary (58mm width)
export function buildReportEscPosBytes({ from, to, income, out, balance, ordersCount, hotelName }: ReportPrintOptions): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const push = (s: string) => chunks.push(enc.encode(s));
  const cmd = (...b: number[]) => chunks.push(new Uint8Array(b));
  const ESC = 0x1b, GS = 0x1d;
  const fmtD = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  cmd(ESC, 0x40);
  cmd(ESC, 0x61, 0x01);
  cmd(ESC, 0x45, 0x01); push(hotelName + '\n'); cmd(ESC, 0x45, 0x00);
  push('Sales Report\n');
  push(`${fmtD(from)} - ${fmtD(to)}\n`);
  push('--------------------------------\n');
  cmd(ESC, 0x61, 0x00);

  const line = (label: string, val: string) => {
    const pad = Math.max(1, 32 - label.length - val.length);
    push(label + ' '.repeat(pad) + val + '\n');
  };
  line('Total Orders', String(ordersCount));
  line('Bills Collected', `Rs.${income.toFixed(2)}`);
  line('Staff + Expenses', `-Rs.${out.toFixed(2)}`);
  push('--------------------------------\n');
  cmd(ESC, 0x45, 0x01);
  line('NET BALANCE', `${balance >= 0 ? '' : '-'}Rs.${Math.abs(balance).toFixed(2)}`);
  cmd(ESC, 0x45, 0x00);
  push('\n\n');
  cmd(GS, 0x56, 0x00);

  return mergeChunks(chunks);
}


interface BillPrintOptions {
  tableOrder: TableOrder;
  menuItems: MenuItem[];
  tableNumber: number; // 1-indexed, for display
  hotelName: string;
  upiId: string;
}

// Build raw ESC/POS bytes for a bill (58mm / 32-char width)
export async function buildBillEscPosBytes({
  tableOrder,
  menuItems,
  tableNumber,
  hotelName,
  upiId,
}: BillPrintOptions): Promise<Uint8Array> {
  const entries = Object.entries(tableOrder).filter(([, qty]) => qty > 0);
  const total = entries.reduce((sum, [itemId, qty]) => {
    const item = menuItems.find((m) => m.id === Number(itemId));
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const now = new Date();
  const ds = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const ts = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const push = (str: string) => chunks.push(enc.encode(str));
  const cmd = (...bytes: number[]) => chunks.push(new Uint8Array(bytes));

  const ESC = 0x1b, GS = 0x1d;
  cmd(ESC, 0x40); // init
  cmd(ESC, 0x61, 0x01); // center align
  cmd(ESC, 0x45, 0x01); push(hotelName + '\n'); cmd(ESC, 0x45, 0x00);
  push(`${ds}  ${ts}\n`);
  push(`Table ${tableNumber}\n`);
  push('--------------------------------\n');
  cmd(ESC, 0x61, 0x00); // left align

  entries.forEach(([itemId, qty]) => {
    const item = menuItems.find((m) => m.id === Number(itemId));
    if (!item) return;
    const lineTotal = (item.price * qty).toFixed(2);
    const left = `${item.name} x${qty}`;
    const pad = Math.max(1, 32 - left.length - lineTotal.length);
    push(left + ' '.repeat(pad) + lineTotal + '\n');
  });

  push('--------------------------------\n');
  cmd(ESC, 0x45, 0x01);
  const totalLine = 'TOTAL';
  const totalVal = `Rs.${total.toFixed(2)}`;
  push(totalLine + ' '.repeat(Math.max(1, 32 - totalLine.length - totalVal.length)) + totalVal + '\n');
  cmd(ESC, 0x45, 0x00);
  push('--------------------------------\n');

  cmd(ESC, 0x61, 0x01);
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(hotelName)}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Table ' + tableNumber)}`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUrl)}`;
  try {
    const qrBytes = await imageUrlToEscPosRaster(qrImgUrl, 300);
    chunks.push(qrBytes);
    push('\n');
  } catch (e) {
    console.error('QR raster failed, falling back to text', e);
    push(`UPI ID: ${upiId}\n`);
  }
  push(`Scan to Pay Rs.${total.toFixed(2)}\n`);
  push('GPay . PhonePe . Paytm . Any UPI\n');
  push('--------------------------------\n');
  push('Thank you! Visit again\n\n\n');
  cmd(GS, 0x56, 0x00); // cut

  return mergeChunks(chunks);
}