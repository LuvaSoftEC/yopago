import type {
  GroupDetailsResponse,
  GroupExpense,
  PaymentResponse,
  AggregatedShare,
  PaymentMemberSummary,
} from '../services/types';

// ─── helpers ───────────────────────────────────────────────────────────────

function esc(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(dateStr: string | undefined | null, locale: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function memberName(m: PaymentMemberSummary | number | undefined | null): string {
  if (!m) return '—';
  if (typeof m === 'number') return `#${m}`;
  return m.name ?? m.email ?? `#${m.id}`;
}

// ─── section builders ───────────────────────────────────────────────────────

function buildExpensesTable(
  expenses: GroupExpense[],
  fmt: (n: number) => string,
  locale: string,
): string {
  if (!expenses.length) return '<p style="color:#5E6B84;font-size:13px;">Sin gastos registrados.</p>';

  const rows = expenses.map((e) => {
    const desc = esc(e.note || e.description || e.tag || '—');
    const cat  = esc(e.tag || e.category || '—');
    const date = fmtDate(e.date || e.createdAt, locale);
    const paidBy = esc(e.paidBy?.name || (e.payer as any)?.name || '—');
    return `<tr>
      <td>${date}</td>
      <td>${desc}</td>
      <td style="color:#5E6B84">${cat}</td>
      <td style="text-align:right;color:#0A8050;font-weight:600">${fmt(e.amount)}</td>
      <td>${paidBy}</td>
    </tr>`;
  }).join('');

  return `<table>
    <thead><tr>
      <th>Fecha</th><th>Descripción</th><th>Categoría</th>
      <th style="text-align:right">Monto</th><th>Pagó por</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildPaymentsTable(
  payments: PaymentResponse[],
  fmt: (n: number) => string,
  locale: string,
): string {
  if (!payments.length) return '<p style="color:#5E6B84;font-size:13px;">Sin pagos registrados.</p>';

  const rows = payments.map((p) => {
    const from   = esc(memberName(p.fromMember));
    const to     = esc(memberName(p.toMember));
    const date   = fmtDate(p.createdAt, locale);
    const method = esc(p.paymentMethod?.toLowerCase() ?? '—');
    const status = p.confirmed
      ? '<span style="color:#22C55E;font-weight:600">✓ Confirmado</span>'
      : '<span style="color:#F59E0B">⏳ Pendiente</span>';
    return `<tr>
      <td>${date}</td>
      <td>${from} → ${to}</td>
      <td style="text-align:right;color:#0A8050;font-weight:600">${fmt(p.amount)}</td>
      <td>${method}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');

  return `<table>
    <thead><tr>
      <th>Fecha</th><th>De → A</th>
      <th style="text-align:right">Monto</th><th>Método</th><th>Estado</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildBalancesTable(
  shares: AggregatedShare[],
  fmt: (n: number) => string,
): string {
  if (!shares.length) return '<p style="color:#5E6B84;font-size:13px;">Sin datos de balance.</p>';

  const rows = shares.map((s) => {
    const name    = esc(s.memberName ?? '—');
    const paid    = fmt(s.totalPaid ?? 0);
    const owes    = fmt(s.totalOwed ?? 0);
    const balance = s.balance ?? 0;
    const balColor = balance >= 0 ? '#22C55E' : '#EF4444';
    const balLabel = balance >= 0 ? `+${fmt(balance)}` : fmt(balance);
    return `<tr>
      <td>${name}</td>
      <td style="text-align:right">${paid}</td>
      <td style="text-align:right">${owes}</td>
      <td style="text-align:right;font-weight:600;color:${balColor}">${balLabel}</td>
    </tr>`;
  }).join('');

  return `<table>
    <thead><tr>
      <th>Miembro</th>
      <th style="text-align:right">Pagó</th>
      <th style="text-align:right">Debe</th>
      <th style="text-align:right">Balance</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ─── main export ────────────────────────────────────────────────────────────

export function generateGroupHTML(
  group: GroupDetailsResponse,
  formatCurrency: (amount: number) => string,
  locale: string = 'es',
): string {
  const generatedOn = new Date().toLocaleDateString(locale, {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const allPayments = [
    ...(group.confirmedPayments ?? []),
    ...(group.pendingPayments ?? []),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const expensesHTML  = buildExpensesTable(group.expenses ?? [], formatCurrency, locale);
  const paymentsHTML  = buildPaymentsTable(allPayments, formatCurrency, locale);
  const balancesHTML  = buildBalancesTable(group.aggregatedShares ?? [], formatCurrency);

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>YoPago – ${esc(group.name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, Helvetica, Arial, sans-serif;
      font-size: 13px;
      color: #0B1220;
      background: #fff;
      padding: 32px 28px;
    }
    /* ── header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      border-bottom: 3px solid #0FB86E;
      margin-bottom: 28px;
    }
    .brand { font-size: 26px; font-weight: 800; color: #0FB86E; letter-spacing: -0.5px; }
    .brand span { color: #0B1220; }
    .group-title { font-size: 18px; font-weight: 700; color: #0B1220; margin: 4px 0 2px; }
    .meta { font-size: 11px; color: #5E6B84; }
    /* ── summary cards ── */
    .summary-row {
      display: flex;
      gap: 12px;
      margin-bottom: 28px;
    }
    .card {
      flex: 1;
      background: #F7FAF9;
      border: 1px solid #E2EBE7;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .card-label { font-size: 11px; color: #5E6B84; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.4px; }
    .card-value { font-size: 18px; font-weight: 700; color: #0FB86E; }
    /* ── sections ── */
    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #0B1220;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding-bottom: 8px;
      border-bottom: 1px solid #E2EBE7;
      margin-bottom: 12px;
    }
    /* ── tables ── */
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead tr { background: #F0F7F4; }
    th {
      padding: 8px 10px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #5E6B84;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    td { padding: 7px 10px; border-bottom: 1px solid #F0F0F0; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: #FAFAFA; }
    /* ── footer ── */
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #E2EBE7;
      font-size: 10px;
      color: #5E6B84;
      text-align: center;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="brand">Yo<span>Pago</span></div>
      <div class="group-title">${esc(group.name)}</div>
      <div class="meta">Código: ${esc(group.code)} &nbsp;·&nbsp; Creado: ${fmtDate(group.createdAt, locale)}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#5E6B84">Reporte de Gastos</div>
      <div style="font-size:11px;color:#5E6B84;">Generado el ${generatedOn}</div>
    </div>
  </div>

  <!-- SUMMARY CARDS -->
  <div class="summary-row">
    <div class="card">
      <div class="card-label">Total gastos</div>
      <div class="card-value">${formatCurrency(group.totalAmount ?? 0)}</div>
    </div>
    <div class="card">
      <div class="card-label">Miembros</div>
      <div class="card-value">${group.totalMembers ?? 0}</div>
    </div>
    <div class="card">
      <div class="card-label">Promedio / miembro</div>
      <div class="card-value">${formatCurrency(group.averagePerMember ?? 0)}</div>
    </div>
    <div class="card">
      <div class="card-label">N.º de gastos</div>
      <div class="card-value">${group.totalExpenses ?? 0}</div>
    </div>
  </div>

  <!-- BALANCES -->
  <div class="section">
    <div class="section-title">Balance por miembro</div>
    ${balancesHTML}
  </div>

  <!-- EXPENSES -->
  <div class="section">
    <div class="section-title">Gastos (${group.expenses?.length ?? 0})</div>
    ${expensesHTML}
  </div>

  <!-- PAYMENTS -->
  <div class="section">
    <div class="section-title">Pagos (${allPayments.length})</div>
    ${paymentsHTML}
  </div>

  <!-- FOOTER -->
  <div class="footer">
    Reporte generado por YoPago &nbsp;·&nbsp; ${generatedOn}<br/>
    Este documento es un resumen informativo del grupo "${esc(group.name)}".
  </div>

</body>
</html>`;
}
