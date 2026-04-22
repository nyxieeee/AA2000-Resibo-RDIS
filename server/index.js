import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { db, initDb } from './database.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- AUTH ROUTES ---
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    // Track login in audit logs
    const device = req.headers['user-agent']?.includes('Mobi') ? 'Mobile' : 'Desktop';
    const browser = req.headers['user-agent']?.includes('Chrome') ? 'Chrome' : 
                    req.headers['user-agent']?.includes('Safari') ? 'Safari' : 'Browser';
    
    db.run(
      "INSERT INTO audit_logs (id, user_id, action, device, browser, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [`log_${Date.now()}`, user.id, 'Login Success', device, browser, 'Manila, PH', new Date().toISOString()]
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        darkMode: !!user.dark_mode
      }
    });
  });
});

// --- DOCUMENT ROUTES ---
app.get('/api/documents', authenticate, (req, res) => {
  db.all("SELECT * FROM documents ORDER BY date DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const docs = rows.map(r => ({
      ...r,
      taxId: r.tax_id,
      docNum: r.doc_num,
      vatableSales: r.vatable_sales,
      zeroRatedSales: r.zero_rated_sales,
      registeredAddress: r.registered_address,
      taxType: r.tax_type,
      paymentMethod: r.payment_method,
      datGenerated: !!r.dat_generated,
      imageData: r.image_data,
      imageType: r.image_type,
      lineItems: JSON.parse(r.line_items || '[]'),
      reviewReason: r.review_reason
    }));
    res.json(docs);
  });
});

app.post('/api/documents', authenticate, (req, res) => {
  const doc = req.body;
  const sql = `INSERT INTO documents (
    id, name, type, vendor, tax_id, category, doc_num, total, confidence, status, date,
    vatable_sales, vat, zero_rated_sales, registered_address, tax_type, payment_method, line_items,
    image_data, image_type, review_reason
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    doc.id, doc.name, doc.type, doc.vendor, doc.taxId, doc.category, doc.docNum, doc.total, doc.confidence, doc.status, doc.date,
    doc.vatableSales, doc.vat, doc.zeroRatedSales, doc.registeredAddress, doc.taxType, doc.paymentMethod, JSON.stringify(doc.lineItems),
    doc.imageData, doc.imageType, doc.reviewReason
  ];

  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: doc.id });
  });
});

app.patch('/api/documents/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  // Build dynamic update query
  const fields = [];
  const params = [];
  
  const mapping = {
    taxId: 'tax_id',
    docNum: 'doc_num',
    vatableSales: 'vatable_sales',
    zeroRatedSales: 'zero_rated_sales',
    registeredAddress: 'registered_address',
    taxType: 'tax_type',
    paymentMethod: 'payment_method',
    datGenerated: 'dat_generated',
    lineItems: 'line_items'
  };

  Object.entries(updates).forEach(([key, value]) => {
    const dbKey = mapping[key] || key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    fields.push(`${dbKey} = ?`);
    params.push(key === 'lineItems' ? JSON.stringify(value) : key === 'datGenerated' ? (value ? 1 : 0) : value);
  });

  if (fields.length === 0) return res.json({ success: true });

  params.push(id);
  db.run(`UPDATE documents SET ${fields.join(', ')} WHERE id = ?`, params, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete('/api/documents/:id', authenticate, (req, res) => {
  db.run("DELETE FROM documents WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- WORKSPACE ROUTES ---
app.get('/api/workspace', authenticate, (req, res) => {
  db.get("SELECT * FROM workspace LIMIT 1", (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Workspace not found' });
    
    res.json({
      id: row.id,
      name: row.name,
      birTin: row.bir_tin,
      birRdo: row.bir_rdo,
      vatRegistered: !!row.vat_registered,
      registeredAddress: row.registered_address,
      companyWebsite: row.company_website,
      industry: row.industry,
      fiscalYearEnd: row.fiscal_year_end,
      filingFrequency: row.filing_frequency,
      withholdingTaxRate: row.withholding_tax_rate,
      dataRetentionPeriod: row.data_retention_period,
      auditLogEnabled: !!row.audit_log_enabled,
      exportApprovalRequired: !!row.export_approval_required,
      expenseCategories: JSON.parse(row.expense_categories || '[]')
    });
  });
});

app.patch('/api/workspace', authenticate, (req, res) => {
  const updates = req.body;
  const fields = [];
  const params = [];

  const mapping = {
    birTin: 'bir_tin',
    birRdo: 'bir_rdo',
    vatRegistered: 'vat_registered',
    registeredAddress: 'registered_address',
    expenseCategories: 'expense_categories',
    auditLogEnabled: 'audit_log_enabled',
    exportApprovalRequired: 'export_approval_required'
  };

  Object.entries(updates).forEach(([key, value]) => {
    const dbKey = mapping[key] || key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    fields.push(`${dbKey} = ?`);
    let finalValue = value;
    if (key === 'expenseCategories') finalValue = JSON.stringify(value);
    else if (['vatRegistered', 'auditLogEnabled', 'exportApprovalRequired'].includes(key)) finalValue = value ? 1 : 0;
    params.push(finalValue);
  });

  if (fields.length === 0) return res.json({ success: true });

  db.run(`UPDATE workspace SET ${fields.join(', ')}`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.patch('/api/auth/profile', authenticate, (req, res) => {
  const { firstName, lastName, email, role, darkMode } = req.body;
  db.run(
    "UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, dark_mode = ? WHERE id = ?",
    [firstName, lastName, email, role, darkMode ? 1 : 0, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.post('/api/auth/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  db.get("SELECT password FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = bcrypt.compareSync(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });

    const hashed = bcrypt.hashSync(newPassword, 10);
    db.run("UPDATE users SET password = ? WHERE id = ?", [hashed, userId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// --- NEW DYNAMIC DATA ROUTES ---

app.get('/api/users', authenticate, (req, res) => {
  if (!['CEO', 'President', 'General Manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  db.all("SELECT id, email, role, first_name, last_name, dark_mode FROM users", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({
      id: r.id,
      email: r.email,
      role: r.role,
      name: `${r.first_name} ${r.last_name}`.trim(),
      firstName: r.first_name,
      lastName: r.last_name,
      status: 'Active'
    })));
  });
});

app.get('/api/security/sessions', authenticate, (req, res) => {
  db.all(
    "SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => ({
        id: r.id,
        device: r.device,
        browser: r.browser,
        location: r.location,
        time: r.created_at,
        action: r.action
      })));
    }
  );
});

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AA2000 RDIS Backend running on port ${PORT} (Accessible on network)`);
  });
});
