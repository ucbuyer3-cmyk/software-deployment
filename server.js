const http = require('http');
const { Client } = require('pg');
const fs = require('fs');
const querystring = require('querystring');

// REPLACE THIS with your Render Internal Database URL
const connectionString = "postgresql://create_database_we6o_user:Z3csniTN0FzYQ5vEimAmCttYA7YOGkyb@dpg-d7ocdphj2pic73dj0nk0-a/create_database_we6o";

const client = new Client({ connectionString });
client.connect().catch(err => console.error('Connection error', err.stack));

// Auto-create table on startup
client.query(`
    CREATE TABLE IF NOT EXISTS persons (
        id SERIAL PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone_number VARCHAR(8) NOT NULL,
        address TEXT NOT NULL,
        age INTEGER NOT NULL
    )
`);

const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        renderForm(res);
    } else if (req.url === '/style.css') {
        res.end(fs.readFileSync('./style.css'));
    } else if (req.method === 'POST' && req.url === '/submit') {
        handlePost(req, res);
    } else if (req.url === '/records') {
        renderTable(res);
    }
});

function renderForm(res, errors = [], values = {}) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    let errorHtml = errors.length > 0
  ? <div class='''error-box"><ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul></div>
  : '';
 res.end(`
  <link rel="stylesheet" href="/style.css">
  ${errorHtml}
  <div class="card">
    <h2>Personal Data Form</h2>
    <form action="/submit" method="POST" novalidate>
      <input type="text" name="first_name" placeholder="First Name" value="${values.first_name || ''}">
      <input type="text" name="last_name" placeholder="Last Name" value="${values.last_name || ''}">
      <input type="text" name="phone" placeholder="Phone (8 digits)" value="${values.phone || ''}">
      <input type="text" name="address" placeholder="Address" value="${values.address || ''}">
    </form>
  </div>
`);
}

async function handlePost(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
        const data = querystring.parse(body);
        const errors = [];

        // Assignment Validation Rules
        if (!data.first_name  !data.last_name  !data.phone  !data.address  !data.age) errors.push("All fields are required.");
        if (data.phone && !/^\d+$/.test(data.phone)) errors.push("Phone must be numeric only.");
        if (data.phone && data.phone.length !== 8) errors.push("Phone must be exactly 8 digits.");

        if (errors.length > 0) {
            return renderForm(res, errors, data); // "Sticky inputs" on error
        }

        // Save to DB using Parameterized Query to prevent SQL Injection
        await client.query(
            'INSERT INTO persons (first_name, last_name, phone_number, address, age) VALUES ($1, $2, $3, $4, $5)',
            [data.first_name, data.last_name, data.phone, data.address, data.age]
        );

        res.writeHead(303, { 'Location': '/records' }); // Post-Redirect-Get
        res.end();
    });
}

async function renderTable(res) {
    const result = await client.query('SELECT * FROM persons');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    let rows = result.rows.map(r => `<tr><td>${r.id}</td><td>${r.first_name}</td><td>${r.last_name}</td><td>${r.phone_number}</td><td>${r.address}</td><td>${r.age}</td></tr>`).join('');
    res.end(`<link rel="stylesheet" href="/style.css"><h2>Submitted Records</h2><table><tr><th>ID</th><th>First Name</th><th>Last Name</th><th>Phone</th><th>Address</th><th>Age</th></tr>${rows}</table><br><a href="/">Add Another</a>`);
}

server.listen(process.env.PORT || 3000);
