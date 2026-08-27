export function printReportInBrowser(
  from: string,
  to: string,
  income: number,
  out: number,
  balance: number,
  ordersCount: number,
  hotelName: string
) {
  const fmtD = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`
    <html><head><title>${hotelName} — Report</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111;}
      h1{font-size:20px;margin-bottom:2px;} p{color:#555;margin-bottom:16px;}
      table{width:100%;border-collapse:collapse;margin-top:10px;}
      td{padding:8px 0;border-bottom:1px solid #ddd;font-size:14px;}
      td:last-child{text-align:right;font-weight:600;}
      .total td{font-size:16px;font-weight:700;border-top:2px solid #111;border-bottom:none;padding-top:12px;}
    </style></head><body>
      <h1>${hotelName} — Sales Report</h1>
      <p>${fmtD(from)} to ${fmtD(to)}</p>
      <table>
        <tr><td>Total Orders</td><td>${ordersCount}</td></tr>
        <tr><td>Bills Collected</td><td>₹${income.toFixed(2)}</td></tr>
        <tr><td>Staff Payments + Expenses</td><td>−₹${out.toFixed(2)}</td></tr>
        <tr class="total"><td>Net Balance</td><td>${balance >= 0 ? '' : '−'}₹${Math.abs(balance).toFixed(2)}</td></tr>
      </table>
    </body></html>
  `);
  w.document.close();
  setTimeout(() => w.print(), 300);
}