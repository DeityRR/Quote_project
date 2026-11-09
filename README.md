# Quote App

A small quotation generator for small businesses. Create, edit and delete quotes, calculate VAT automatically, and print or save each quote as a PDF.

Built with Node.js, Express and SQLite. The front end is plain HTML, CSS and JavaScript, with no build step.

## Features

- Create, edit and delete quotes with multiple line items
- Totals and VAT calculated on the server (and previewed live in the browser)
- Input validation with clear error messages
- Printable A4 quote page. Use the browser's "Save as PDF" and Thai text renders correctly
- Quote numbers generated automatically, for example `QT-2026-0001`

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000. Set `PORT` to use a different port. Data is stored in `quotes.db` in the project folder.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/quotes` | List all quotes with totals |
| GET | `/api/quotes/:id` | Get one quote |
| POST | `/api/quotes` | Create a quote |
| PUT | `/api/quotes/:id` | Replace a quote and its items |
| DELETE | `/api/quotes/:id` | Delete a quote |

Example body for POST and PUT:

```json
{
  "customer_name": "Example Co., Ltd.",
  "customer_address": "123 Example Road, Chiang Mai",
  "issue_date": "2026-11-10",
  "vat_rate": 7,
  "note": "Valid for 30 days",
  "items": [
    { "description": "Website design", "qty": 1, "unit_price": 15000 },
    { "description": "Hosting (12 months)", "qty": 12, "unit_price": 300 }
  ]
}
```

## Design decisions

- **SQLite with `better-sqlite3`:** no separate database server, so setup is one command.
- **Totals calculated on the server:** the client is never trusted for money values.
- **Print page instead of a PDF library:** the browser's print engine handles Thai fonts reliably. PDFKit's default fonts do not include Thai, so a library would need a bundled Thai font such as Sarabun.

## Ideas for next steps

- Quote status (draft, sent, accepted)
- Saved customers and a product catalogue
- Login and per-user data
- Server-side PDF generation with a bundled Thai font
- Automated tests for the API
