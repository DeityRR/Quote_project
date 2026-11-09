const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, 'quotes.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_address TEXT NOT NULL DEFAULT '',
  issue_date TEXT NOT NULL,
  vat_rate REAL NOT NULL DEFAULT 7,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS quote_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  qty REAL NOT NULL,
  unit_price REAL NOT NULL
);
`);

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function totals(items, vatRate) {
  const subtotal = round2(items.reduce((s, i) => s + round2(i.qty * i.unit_price), 0));
  const vat = round2((subtotal * vatRate) / 100);
  return { subtotal, vat, total: round2(subtotal + vat) };
}

// Validate and clean the request body. Returns { error } or { data }.
function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'Request body is missing.' };
  const customer_name = String(body.customer_name || '').trim();
  if (!customer_name) return { error: 'Customer name is required.' };
  const issue_date = String(body.issue_date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issue_date)) return { error: 'Issue date must be YYYY-MM-DD.' };
  const vat_rate = Number(body.vat_rate ?? 7);
  if (!Number.isFinite(vat_rate) || vat_rate < 0 || vat_rate > 100) {
    return { error: 'VAT rate must be between 0 and 100.' };
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { error: 'Add at least one item.' };
  }
  const items = [];
  for (const [i, raw] of body.items.entries()) {
    const description = String(raw.description || '').trim();
    const qty = Number(raw.qty);
    const unit_price = Number(raw.unit_price);
    if (!description) return { error: `Item ${i + 1}: description is required.` };
    if (!Number.isFinite(qty) || qty <= 0) return { error: `Item ${i + 1}: quantity must be more than 0.` };
    if (!Number.isFinite(unit_price) || unit_price < 0) return { error: `Item ${i + 1}: price cannot be negative.` };
    items.push({ description, qty, unit_price });
  }
  return {
    data: {
      customer_name,
      customer_address: String(body.customer_address || '').trim(),
      issue_date,
      vat_rate,
      note: String(body.note || '').trim(),
      items,
    },
  };
}

const q = {
  get: db.prepare('SELECT * FROM quotes WHERE id = ?'),
  list: db.prepare('SELECT * FROM quotes ORDER BY id DESC'),
  items: db.prepare('SELECT description, qty, unit_price FROM quote_items WHERE quote_id = ? ORDER BY id'),
  insert: db.prepare(
    'INSERT INTO quotes (customer_name, customer_address, issue_date, vat_rate, note) VALUES (@customer_name, @customer_address, @issue_date, @vat_rate, @note)'
  ),
  update: db.prepare(
    'UPDATE quotes SET customer_name=@customer_name, customer_address=@customer_address, issue_date=@issue_date, vat_rate=@vat_rate, note=@note WHERE id=@id'
  ),
  insertItem: db.prepare(
    'INSERT INTO quote_items (quote_id, description, qty, unit_price) VALUES (?, ?, ?, ?)'
  ),
  deleteItems: db.prepare('DELETE FROM quote_items WHERE quote_id = ?'),
  delete: db.prepare('DELETE FROM quotes WHERE id = ?'),
};

function loadQuote(id) {
  const row = q.get.get(id);
  if (!row) return null;
  const items = q.items.all(id);
  return {
    ...row,
    number: `QT-${row.issue_date.slice(0, 4)}-${String(row.id).padStart(4, '0')}`,
    items,
    ...totals(items, row.vat_rate),
  };
}

const save = db.transaction((id, data) => {
  let quoteId = id;
  if (id) {
    q.update.run({ ...data, id });
    q.deleteItems.run(id);
  } else {
    quoteId = q.insert.run(data).lastInsertRowid;
  }
  for (const it of data.items) q.insertItem.run(quoteId, it.description, it.qty, it.unit_price);
  return Number(quoteId);
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/quotes', (req, res) => {
  res.json(q.list.all().map((r) => loadQuote(r.id)));
});

app.get('/api/quotes/:id', (req, res) => {
  const quote = loadQuote(Number(req.params.id));
  if (!quote) return res.status(404).json({ error: 'Quote not found.' });
  res.json(quote);
});

app.post('/api/quotes', (req, res) => {
  const { error, data } = validate(req.body);
  if (error) return res.status(400).json({ error });
  res.status(201).json(loadQuote(save(null, data)));
});

app.put('/api/quotes/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!q.get.get(id)) return res.status(404).json({ error: 'Quote not found.' });
  const { error, data } = validate(req.body);
  if (error) return res.status(400).json({ error });
  res.json(loadQuote(save(id, data)));
});

app.delete('/api/quotes/:id', (req, res) => {
  const result = q.delete.run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Quote not found.' });
  res.status(204).end();
});

// Malformed JSON and other unexpected errors
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : err.message });
  if (status === 500) console.error(err);
});

app.listen(PORT, () => console.log(`Quote app running at http://localhost:${PORT}`));
