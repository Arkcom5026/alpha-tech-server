'use strict'

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const money = (value) => Number(value || 0).toLocaleString('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const thaiDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date)
}

const assertProjection = (projection) => {
  if (
    projection?.document?.type !== 'SALE_RECEIPT'
    || !projection?.document?.title
    || !projection?.document?.number
    || !projection?.issuer?.name
    || !projection?.sale
    || !projection?.payment
    || !Array.isArray(projection?.lines)
  ) {
    throw fail(
      'STORE_DEVICE_SALE_RECEIPT_80MM_PROJECTION_INVALID',
      'Sale receipt projection is not compatible with the 80mm receipt renderer',
      409,
    )
  }
  return projection
}

const renderLine = (line) => {
  const quantity = Number(line.quantity || 0)
  const qty = Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString('th-TH')
  const description = escapeHtml(line.description || 'รายการสินค้า')
  const barcode = line.barcode
    ? `<div class="muted">${escapeHtml(line.barcode)}</div>`
    : ''

  return `
    <div class="item">
      <div class="item-title">${description}</div>
      ${barcode}
      <div class="row">
        <span>${escapeHtml(qty)} x ${money(line.unitAmount)}</span>
        <strong>${money(line.lineAmount)}</strong>
      </div>
      ${Number(line.discountAmount || 0) !== 0
        ? `<div class="row muted"><span>ส่วนลด/ปรับราคา</span><span>${money(line.discountAmount)}</span></div>`
        : ''}
    </div>`
}

const renderPayments = (items = []) => items.map((item) => `
  <div class="row">
    <span>${escapeHtml(item.paymentMethod || 'PAYMENT')}</span>
    <span>${money(item.amount)}</span>
  </div>`).join('')

const renderSaleReceipt80mmHtml = ({ projection }) => {
  const data = assertProjection(projection)
  const recipientName = data.recipient?.name ? escapeHtml(data.recipient.name) : 'ลูกค้าทั่วไป'
  const recipientPhone = data.recipient?.phone
    ? `<div>โทร ${escapeHtml(data.recipient.phone)}</div>`
    : ''
  const paymentRows = renderPayments(data.payment.items)

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>${escapeHtml(data.document.title)} ${escapeHtml(data.document.number)}</title>
<style>
  @page { size: 80mm auto; margin: 3.5mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Leelawadee UI", "Tahoma", sans-serif;
    font-size: 11px;
    line-height: 1.35;
    color: #111;
  }
  .center { text-align: center; }
  .title { font-size: 16px; font-weight: 700; }
  .doc-title { font-size: 13px; font-weight: 700; margin-top: 4px; }
  .muted { color: #555; font-size: 10px; }
  .rule { border-top: 1px dashed #333; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .item { margin: 5px 0; }
  .item-title { font-weight: 600; overflow-wrap: anywhere; }
  .totals .row { margin: 2px 0; }
  .grand { font-size: 14px; font-weight: 700; }
  .footer { margin-top: 8px; font-size: 10px; }
</style>
</head>
<body>
  <div class="center">
    <div class="title">${escapeHtml(data.issuer.name)}</div>
    <div class="doc-title">${escapeHtml(data.document.title)}</div>
    <div>เลขที่ ${escapeHtml(data.document.number)}</div>
    <div>${escapeHtml(thaiDateTime(data.document.issuedAt || data.payment.receivedAt || data.sale.soldAt))}</div>
  </div>

  <div class="rule"></div>
  <div><strong>ลูกค้า:</strong> ${recipientName}</div>
  ${recipientPhone}
  <div><strong>เลขที่ขาย:</strong> ${escapeHtml(data.sale.code || '-')}</div>

  <div class="rule"></div>
  ${data.lines.map(renderLine).join('')}

  <div class="rule"></div>
  <div class="totals">
    <div class="row"><span>รวมก่อนส่วนลด</span><span>${money(data.sale.totalBeforeDiscount)}</span></div>
    <div class="row"><span>ส่วนลด/ปรับราคา</span><span>${money(data.sale.totalDiscount)}</span></div>
    <div class="row"><span>ภาษีมูลค่าเพิ่ม</span><span>${money(data.sale.vatAmount)}</span></div>
    <div class="row grand"><span>ยอดสุทธิ</span><span>${money(data.sale.totalAmount)}</span></div>
  </div>

  <div class="rule"></div>
  <div><strong>การชำระเงิน</strong></div>
  ${paymentRows || `<div class="row"><span>ยอดรับชำระ</span><span>${money(data.payment.amount)}</span></div>`}

  <div class="footer center">
    <div>ขอบคุณที่ใช้บริการ</div>
    <div class="muted">เอกสารนี้สร้างจากระบบ Alpha-Tech</div>
  </div>
</body>
</html>`
}

module.exports = {
  renderSaleReceipt80mmHtml,
}
