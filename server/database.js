import sqlite3 from 'sqlite3';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const dbFile = process.env.DATABASE_FILE || 'database.sqlite';
const db = new sqlite3.Database(dbFile);

const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users Table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          password TEXT,
          role TEXT,
          first_name TEXT,
          last_name TEXT,
          dark_mode INTEGER DEFAULT 0
        )
      `);

      // Audit Logs Table
      db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          action TEXT,
          device TEXT,
          browser TEXT,
          location TEXT,
          created_at TEXT,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `);

      // Documents Table
      db.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          name TEXT,
          type TEXT,
          vendor TEXT,
          tax_id TEXT,
          category TEXT,
          doc_num TEXT,
          total REAL,
          confidence REAL,
          status TEXT,
          date TEXT,
          vatable_sales REAL,
          vat REAL,
          zero_rated_sales REAL,
          registered_address TEXT,
          tax_type TEXT,
          payment_method TEXT,
          dat_generated INTEGER DEFAULT 0,
          image_data TEXT,
          image_type TEXT,
          line_items TEXT, -- Store as JSON string
          review_reason TEXT
        )
      `);

      // Create initial demo users if none exist
      db.get("SELECT count(*) as count FROM users", (err, row) => {
        if (row && row.count === 0) {
          const demoUsers = [
            { id: '1', email: 'ceo@aa2000.com.ph', pass: 'admin', role: 'CEO', fn: 'CEO', ln: 'Administrator' },
            { id: '2', email: 'president@aa2000.com.ph', pass: 'admin', role: 'President', fn: 'President', ln: 'User' },
            { id: '3', email: 'gm@aa2000.com.ph', pass: 'admin', role: 'General Manager', fn: 'GM', ln: 'Officer' },
            { id: '4', email: 'accountant1@aa2000.com.ph', pass: 'accounting', role: 'Accountant', fn: 'Accountant', ln: 'Alpha' },
            { id: '5', email: 'accountant2@aa2000.com.ph', pass: 'accounting', role: 'Accountant', fn: 'Accountant', ln: 'Beta' }
          ];

          demoUsers.forEach((u, i) => {
            const hash = bcrypt.hashSync(u.pass, 10);
            db.run(
              "INSERT INTO users (id, email, password, role, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)",
              [u.id, u.email, hash, u.role, u.fn, u.ln]
            );

            // Add an initial audit log for the current session for each user
            db.run(
              "INSERT INTO audit_logs (id, user_id, action, device, browser, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [`log_${u.id}_init`, u.id, 'Account Created', 'Desktop', 'Chrome', 'Manila, PH', new Date().toISOString()]
            );
          });
          console.log("Team users created and audit logs initialized.");
        }
      });

      // Workspace Table
      db.run(`
        CREATE TABLE IF NOT EXISTS workspace (
          id TEXT PRIMARY KEY,
          name TEXT,
          bir_tin TEXT,
          bir_rdo TEXT,
          vat_registered INTEGER DEFAULT 0,
          registered_address TEXT,
          expense_categories TEXT, -- JSON
          company_website TEXT,
          industry TEXT,
          fiscal_year_end TEXT,
          filing_frequency TEXT,
          withholding_tax_rate REAL,
          data_retention_period TEXT,
          audit_log_enabled INTEGER DEFAULT 1,
          export_approval_required INTEGER DEFAULT 1
        )
      `);

      // Migration: Update workspace with missing columns
      const migrations = [
        "ALTER TABLE workspace ADD COLUMN registered_address TEXT",
        "ALTER TABLE workspace ADD COLUMN company_website TEXT",
        "ALTER TABLE workspace ADD COLUMN industry TEXT",
        "ALTER TABLE workspace ADD COLUMN fiscal_year_end TEXT",
        "ALTER TABLE workspace ADD COLUMN filing_frequency TEXT",
        "ALTER TABLE workspace ADD COLUMN withholding_tax_rate REAL",
        "ALTER TABLE workspace ADD COLUMN data_retention_period TEXT",
        "ALTER TABLE workspace ADD COLUMN audit_log_enabled INTEGER DEFAULT 1",
        "ALTER TABLE workspace ADD COLUMN export_approval_required INTEGER DEFAULT 1",
        "ALTER TABLE users ADD COLUMN dark_mode INTEGER DEFAULT 0",
        "ALTER TABLE documents ADD COLUMN review_reason TEXT"
      ];
      migrations.forEach(sql => db.run(sql, () => {}));

      // Seed workspace if empty
      db.get("SELECT count(*) as count FROM workspace", (err, row) => {
        if (row && row.count === 0) {
          db.run(
            `INSERT INTO workspace (
              id, name, bir_tin, bir_rdo, vat_registered, registered_address, 
              company_website, industry, fiscal_year_end, filing_frequency, 
              withholding_tax_rate, data_retention_period, audit_log_enabled, 
              export_approval_required, expense_categories
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              'ws_01', 
              'AA2000 Security And Technology', 
              '000-111-222-000', 
              '043', 
              1, 
              'Manila, Philippines', 
              'https://aa2000.com.ph', 
              'Real Estate', 
              'December 31', 
              'Monthly', 
              2.0, 
              '12', 
              1, 
              1, 
              JSON.stringify(['Cost of Sales', 'Travel', 'Meals', 'Bank Charges', 'Office Supplies'])
            ]
          );
        }
      });

      resolve(db);
    });
  });
};

export { db, initDb };
