/**
 * Opens a clean print window with the given HTML body and triggers the browser print dialog.
 * Used for token slips, patient cards, receipts, and prescriptions. Keeps print styling
 * isolated from the app's Tailwind bundle so output is predictable on thermal/A4 printers.
 */
export function printHtml(title: string, bodyHtml: string, widthMm = 80): void {
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return;
  win.document.write(`<!doctype html>
<html>
<head>
<title>${title}</title>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-monospace, "Courier New", monospace; color: #111; margin: 0; padding: 12px; width: ${widthMm}mm; }
  h1, h2, h3 { margin: 0 0 4px; }
  .center { text-align: center; }
  .muted { color: #555; font-size: 12px; }
  .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; margin: 2px 0; }
  .divider { border: 0; border-top: 1px dashed #999; margin: 8px 0; }
  .big { font-size: 40px; font-weight: 700; line-height: 1; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td, th { padding: 3px 0; text-align: left; }
  th { border-bottom: 1px solid #333; }
  .right { text-align: right; }
  @media print { @page { margin: 6mm; } body { padding: 0; } }
</style>
</head>
<body>${bodyHtml}</body>
</html>`);
  win.document.close();
  win.focus();
  // Give the new document a tick to lay out before printing.
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);
}

function esc(v: string | number | null | undefined): string {
  return String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

export function tokenSlipHtml(a: {
  clinicName: string;
  tokenNo: number;
  patientName: string;
  mrNo: string | null;
  doctorName: string;
  roomNo: string | null;
  date: string;
  visitType: string;
}): string {
  return `
    <div class="center">
      <h2>${esc(a.clinicName)}</h2>
      <div class="muted">Token Slip</div>
      <hr class="divider" />
      <div class="muted">TOKEN NUMBER</div>
      <div class="big">${a.tokenNo}</div>
      <hr class="divider" />
    </div>
    <div class="row"><span>Patient</span><strong>${esc(a.patientName)}</strong></div>
    <div class="row"><span>MR No</span><span>${esc(a.mrNo)}</span></div>
    <div class="row"><span>Doctor</span><span>${esc(a.doctorName)}</span></div>
    <div class="row"><span>Room</span><span>${esc(a.roomNo)}</span></div>
    <div class="row"><span>Visit</span><span>${esc(a.visitType)}</span></div>
    <div class="row"><span>Date</span><span>${esc(a.date)}</span></div>
    <hr class="divider" />
    <div class="center muted">Please keep this slip until your turn</div>`;
}

export function patientCardHtml(p: {
  clinicName: string;
  mrNo: string;
  patientName: string;
  fatherHusbandName: string | null;
  gender: string;
  age: string;
  mobileNo: string | null;
  cnic: string | null;
  category: string;
}): string {
  return `
    <div class="center"><h2>${esc(p.clinicName)}</h2><div class="muted">Patient Card</div></div>
    <hr class="divider" />
    <div class="row"><span>MR No</span><strong>${esc(p.mrNo)}</strong></div>
    <div class="row"><span>Name</span><span>${esc(p.patientName)}</span></div>
    <div class="row"><span>Father/Husband</span><span>${esc(p.fatherHusbandName)}</span></div>
    <div class="row"><span>Gender / Age</span><span>${esc(p.gender)} / ${esc(p.age)}</span></div>
    <div class="row"><span>Mobile</span><span>${esc(p.mobileNo)}</span></div>
    <div class="row"><span>CNIC</span><span>${esc(p.cnic)}</span></div>
    <div class="row"><span>Category</span><span>${esc(p.category)}</span></div>`;
}

export function receiptHtml(inv: {
  clinicName: string;
  invoiceNo: string;
  patientName: string;
  mrNo: string;
  date: string;
  items: { description: string; quantity: number; unitPrice: number; amount: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  status: string;
  currency: string;
}): string {
  const cur = (n: number) => `${inv.currency} ${n.toLocaleString()}`;
  const rows = inv.items
    .map(
      (it) =>
        `<tr><td>${esc(it.description)}</td><td class="right">${it.quantity}</td><td class="right">${cur(it.unitPrice)}</td><td class="right">${cur(it.amount)}</td></tr>`,
    )
    .join("");
  return `
    <div class="center"><h2>${esc(inv.clinicName)}</h2><div class="muted">Receipt · ${esc(inv.invoiceNo)}</div></div>
    <hr class="divider" />
    <div class="row"><span>Patient</span><span>${esc(inv.patientName)} (${esc(inv.mrNo)})</span></div>
    <div class="row"><span>Date</span><span>${esc(inv.date)}</span></div>
    <hr class="divider" />
    <table><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Amt</th></tr></thead><tbody>${rows}</tbody></table>
    <hr class="divider" />
    <div class="row"><span>Subtotal</span><span>${cur(inv.subtotal)}</span></div>
    <div class="row"><span>Discount</span><span>-${cur(inv.discount)}</span></div>
    <div class="row"><span>Tax</span><span>${cur(inv.tax)}</span></div>
    <div class="row"><strong>Total</strong><strong>${cur(inv.total)}</strong></div>
    <div class="row"><span>Paid</span><span>${cur(inv.paidAmount)}</span></div>
    <div class="row"><span>Status</span><strong>${esc(inv.status)}</strong></div>
    <hr class="divider" />
    <div class="center muted">Thank you for your visit</div>`;
}
