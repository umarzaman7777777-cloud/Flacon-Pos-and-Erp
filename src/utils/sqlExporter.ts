import { AppState } from '../types';
import { triggerUniversalDownload } from './universalDownloader';

/**
 * Escapes a string for ANSI SQL INSERT statements.
 */
function sqlEscape(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? '0' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

export interface SQLTableSummary {
  tableName: string;
  rowCount: number;
  columns: { name: string; type: string }[];
  sampleSQL: string;
}

/**
 * Generates an ANSI-standard SQL schema and data dump file for the Falcon Rod Maker ERP.
 * Compatible with SQLite, PostgreSQL, MySQL, MariaDB, and Supabase.
 */
export function generateSQLDump(appState: AppState, userEmail?: string, projectId?: string, databaseId?: string): string {
  const timestamp = new Date().toISOString();
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  let sql = `-- =====================================================================\n`;
  sql += `-- Falcon Rod Maker ERP & POS — Relational SQL Database Dump\n`;
  sql += `-- Generated: ${timestamp} (${dateStr})\n`;
  sql += `-- Target Cloud Project: ${projectId || 'gen-lang-client-0360687883'}\n`;
  sql += `-- Target Cloud Firestore Database: ${databaseId || 'ai-studio-falconrodmakerpo-4ec08e17-6c91-4aca-b59a-d747b503ca3a'}\n`;
  sql += `-- Owner / Authenticated Account: ${userEmail || 'umarzaman7777777@gmail.com'}\n`;
  sql += `-- Engine Compatibility: SQLite 3 / PostgreSQL 14+ / MySQL 8.0+ / MariaDB\n`;
  sql += `-- =====================================================================\n\n`;

  sql += `BEGIN TRANSACTION;\n\n`;

  // 1. Table: products
  sql += `-- ---------------------------------------------------------------------\n`;
  sql += `-- Table: products\n`;
  sql += `-- ---------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS products (\n`;
  sql += `  id INTEGER PRIMARY KEY,\n`;
  sql += `  name VARCHAR(255) NOT NULL,\n`;
  sql += `  category VARCHAR(100),\n`;
  sql += `  price DECIMAL(10, 2) DEFAULT 0.00,\n`;
  sql += `  stock INTEGER DEFAULT 0,\n`;
  sql += `  reorder_level INTEGER DEFAULT 5,\n`;
  sql += `  color VARCHAR(50),\n`;
  sql += `  size VARCHAR(50),\n`;
  sql += `  gauge VARCHAR(50),\n`;
  sql += `  weight VARCHAR(50)\n`;
  sql += `);\n\n`;

  if (appState.products && appState.products.length > 0) {
    sql += `INSERT INTO products (id, name, category, price, stock, reorder_level, color, size, gauge, weight) VALUES\n`;
    const rows = appState.products.map(p => {
      return `  (${p.id}, ${sqlEscape(p.name)}, ${sqlEscape(p.cat)}, ${p.price || 0}, ${p.stock || 0}, ${p.reorderLevel || 0}, ${sqlEscape(p.color)}, ${sqlEscape(p.size)}, ${sqlEscape(p.gauge)}, ${sqlEscape(p.weight)})`;
    });
    sql += rows.join(',\n') + ';\n\n';
  }

  // 2. Table: factories
  sql += `-- ---------------------------------------------------------------------\n`;
  sql += `-- Table: factories (Vendors / Industrial Clients)\n`;
  sql += `-- ---------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS factories (\n`;
  sql += `  name VARCHAR(255) PRIMARY KEY,\n`;
  sql += `  location VARCHAR(255),\n`;
  sql += `  contact VARCHAR(100)\n`;
  sql += `);\n\n`;

  if (appState.factories && appState.factories.length > 0) {
    sql += `INSERT INTO factories (name, location, contact) VALUES\n`;
    const rows = appState.factories.map(f => {
      return `  (${sqlEscape(f.name)}, ${sqlEscape(f.location)}, ${sqlEscape(f.contact)})`;
    });
    sql += rows.join(',\n') + ';\n\n';
  }

  // 3. Table: transactions
  sql += `-- ---------------------------------------------------------------------\n`;
  sql += `-- Table: transactions (Sales, Orders, Deliveries)\n`;
  sql += `-- ---------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS transactions (\n`;
  sql += `  id VARCHAR(64) PRIMARY KEY,\n`;
  sql += `  transaction_date VARCHAR(20),\n`;
  sql += `  transaction_time VARCHAR(20),\n`;
  sql += `  party_name VARCHAR(255),\n`;
  sql += `  item_count INTEGER DEFAULT 0,\n`;
  sql += `  items_summary TEXT,\n`;
  sql += `  total_amount DECIMAL(12, 2) DEFAULT 0.00,\n`;
  sql += `  is_paid BOOLEAN DEFAULT FALSE,\n`;
  sql += `  payment_method VARCHAR(50),\n`;
  sql += `  is_confirmed BOOLEAN DEFAULT TRUE,\n`;
  sql += `  is_job_work BOOLEAN DEFAULT FALSE,\n`;
  sql += `  written_off DECIMAL(10, 2) DEFAULT 0.00\n`;
  sql += `);\n\n`;

  if (appState.transactions && appState.transactions.length > 0) {
    sql += `INSERT INTO transactions (id, transaction_date, transaction_time, party_name, item_count, items_summary, total_amount, is_paid, payment_method, is_confirmed, is_job_work, written_off) VALUES\n`;
    const rows = appState.transactions.map(t => {
      return `  (${sqlEscape(t.id)}, ${sqlEscape(t.date)}, ${sqlEscape(t.time)}, ${sqlEscape(t.factory)}, ${t.itemCount || 0}, ${sqlEscape(t.itemsSummary)}, ${t.total || 0}, ${t.paid ? 'TRUE' : 'FALSE'}, ${sqlEscape(t.method)}, ${t.confirmed ? 'TRUE' : 'FALSE'}, ${t.isJobWork ? 'TRUE' : 'FALSE'}, ${t.writtenOff || 0})`;
    });
    sql += rows.join(',\n') + ';\n\n';
  }

  // 4. Table: expenses
  sql += `-- ---------------------------------------------------------------------\n`;
  sql += `-- Table: expenses\n`;
  sql += `-- ---------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS expenses (\n`;
  sql += `  id VARCHAR(64) PRIMARY KEY,\n`;
  sql += `  category VARCHAR(100),\n`;
  sql += `  amount DECIMAL(10, 2) NOT NULL,\n`;
  sql += `  expense_date VARCHAR(20),\n`;
  sql += `  payment_method VARCHAR(50),\n`;
  sql += `  description TEXT\n`;
  sql += `);\n\n`;

  if (appState.expenses && appState.expenses.length > 0) {
    sql += `INSERT INTO expenses (id, category, amount, expense_date, payment_method, description) VALUES\n`;
    const rows = appState.expenses.map(e => {
      return `  (${sqlEscape(e.id)}, ${sqlEscape(e.category)}, ${e.amount || 0}, ${sqlEscape(e.date)}, ${sqlEscape(e.method)}, ${sqlEscape(e.desc)})`;
    });
    sql += rows.join(',\n') + ';\n\n';
  }

  // 5. Table: raw_stock
  sql += `-- ---------------------------------------------------------------------\n`;
  sql += `-- Table: raw_stock (Raw Material Inventory)\n`;
  sql += `-- ---------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS raw_stock (\n`;
  sql += `  id VARCHAR(64) PRIMARY KEY,\n`;
  sql += `  name VARCHAR(255) NOT NULL,\n`;
  sql += `  category VARCHAR(100),\n`;
  sql += `  quantity DECIMAL(10, 2) DEFAULT 0,\n`;
  sql += `  unit VARCHAR(50),\n`;
  sql += `  weight DECIMAL(10, 2) DEFAULT 0,\n`;
  sql += `  low_stock_threshold DECIMAL(10, 2) DEFAULT 10,\n`;
  sql += `  last_updated VARCHAR(50)\n`;
  sql += `);\n\n`;

  if (appState.rawStock && appState.rawStock.length > 0) {
    sql += `INSERT INTO raw_stock (id, name, category, quantity, unit, weight, low_stock_threshold, last_updated) VALUES\n`;
    const rows = appState.rawStock.map((r, idx) => {
      const idVal = r.id || `raw_${idx + 1}`;
      return `  (${sqlEscape(idVal)}, ${sqlEscape(r.name)}, ${sqlEscape(r.category)}, ${r.quantity || r.items || 0}, ${sqlEscape(r.unit || 'units')}, ${r.weight || 0}, ${r.lowStockThreshold || 10}, ${sqlEscape(r.lastUpdated)})`;
    });
    sql += rows.join(',\n') + ';\n\n';
  }

  // 6. Table: customer_ledgers
  sql += `-- ---------------------------------------------------------------------\n`;
  sql += `-- Table: customer_ledger_entries\n`;
  sql += `-- ---------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS customer_ledger_entries (\n`;
  sql += `  id VARCHAR(64) PRIMARY KEY,\n`;
  sql += `  party_name VARCHAR(255) NOT NULL,\n`;
  sql += `  entry_date VARCHAR(20),\n`;
  sql += `  description TEXT,\n`;
  sql += `  debit DECIMAL(12, 2) DEFAULT 0.00,\n`;
  sql += `  credit DECIMAL(12, 2) DEFAULT 0.00,\n`;
  sql += `  payment_method VARCHAR(50),\n`;
  sql += `  cheque_status VARCHAR(50)\n`;
  sql += `);\n\n`;

  if (appState.customerLedgers) {
    const allLedgerRows: string[] = [];
    Object.entries(appState.customerLedgers).forEach(([partyName, account]) => {
      if (account && Array.isArray(account.entries)) {
        account.entries.forEach(entry => {
          allLedgerRows.push(
            `  (${sqlEscape(entry.id)}, ${sqlEscape(partyName)}, ${sqlEscape(entry.date)}, ${sqlEscape(entry.desc)}, ${entry.debit || 0}, ${entry.credit || 0}, ${sqlEscape(entry.method)}, ${sqlEscape(entry.chequeStatus)})`
          );
        });
      }
    });

    if (allLedgerRows.length > 0) {
      sql += `INSERT INTO customer_ledger_entries (id, party_name, entry_date, description, debit, credit, payment_method, cheque_status) VALUES\n`;
      sql += allLedgerRows.join(',\n') + ';\n\n';
    }
  }

  sql += `COMMIT;\n`;
  sql += `-- End of Falcon Rod Maker SQL Database Dump\n`;

  return sql;
}

/**
 * Initiates browser download of the generated .sql file.
 */
export function downloadSQLFile(appState: AppState, userEmail?: string, projectId?: string, databaseId?: string): void {
  const sqlContent = generateSQLDump(appState, userEmail, projectId, databaseId);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `Falcon_ERP_Database_Dump_${today}.sql`;
  const blob = new Blob([sqlContent], { type: 'application/sql;charset=utf-8;' });
  const dataUrl = `data:application/sql;charset=utf-8,${encodeURIComponent(sqlContent)}`;

  triggerUniversalDownload({
    fileName: filename,
    content: blob,
    dataUrl,
    mimeType: 'application/sql',
    format: 'sql',
    rawContent: sqlContent,
    title: 'Falcon Database SQL Dump'
  });
}

/**
 * Returns structured metadata on all tables for the interactive schema browser.
 */
export function getSQLTableSummaries(appState: AppState): SQLTableSummary[] {
  let ledgerCount = 0;
  if (appState.customerLedgers) {
    Object.values(appState.customerLedgers).forEach(acc => {
      if (acc && Array.isArray(acc.entries)) ledgerCount += acc.entries.length;
    });
  }

  return [
    {
      tableName: 'products',
      rowCount: appState.products?.length || 0,
      columns: [
        { name: 'id', type: 'INTEGER (PK)' },
        { name: 'name', type: 'VARCHAR(255)' },
        { name: 'category', type: 'VARCHAR(100)' },
        { name: 'price', type: 'DECIMAL(10,2)' },
        { name: 'stock', type: 'INTEGER' },
        { name: 'reorder_level', type: 'INTEGER' },
        { name: 'color', type: 'VARCHAR(50)' },
        { name: 'size', type: 'VARCHAR(50)' }
      ],
      sampleSQL: 'SELECT id, name, category, price, stock FROM products ORDER BY id ASC LIMIT 5;'
    },
    {
      tableName: 'transactions',
      rowCount: appState.transactions?.length || 0,
      columns: [
        { name: 'id', type: 'VARCHAR(64) (PK)' },
        { name: 'party_name', type: 'VARCHAR(255)' },
        { name: 'transaction_date', type: 'VARCHAR(20)' },
        { name: 'total_amount', type: 'DECIMAL(12,2)' },
        { name: 'is_paid', type: 'BOOLEAN' },
        { name: 'payment_method', type: 'VARCHAR(50)' }
      ],
      sampleSQL: 'SELECT id, party_name, transaction_date, total_amount, is_paid FROM transactions ORDER BY transaction_date DESC LIMIT 5;'
    },
    {
      tableName: 'factories',
      rowCount: appState.factories?.length || 0,
      columns: [
        { name: 'name', type: 'VARCHAR(255) (PK)' },
        { name: 'location', type: 'VARCHAR(255)' },
        { name: 'contact', type: 'VARCHAR(100)' }
      ],
      sampleSQL: 'SELECT name, location, contact FROM factories ORDER BY name ASC;'
    },
    {
      tableName: 'expenses',
      rowCount: appState.expenses?.length || 0,
      columns: [
        { name: 'id', type: 'VARCHAR(64) (PK)' },
        { name: 'category', type: 'VARCHAR(100)' },
        { name: 'amount', type: 'DECIMAL(10,2)' },
        { name: 'expense_date', type: 'VARCHAR(20)' },
        { name: 'payment_method', type: 'VARCHAR(50)' },
        { name: 'description', type: 'TEXT' }
      ],
      sampleSQL: 'SELECT category, SUM(amount) AS total_spent FROM expenses GROUP BY category;'
    },
    {
      tableName: 'raw_stock',
      rowCount: appState.rawStock?.length || 0,
      columns: [
        { name: 'id', type: 'VARCHAR(64) (PK)' },
        { name: 'name', type: 'VARCHAR(255)' },
        { name: 'category', type: 'VARCHAR(100)' },
        { name: 'quantity', type: 'DECIMAL(10,2)' },
        { name: 'unit', type: 'VARCHAR(50)' }
      ],
      sampleSQL: 'SELECT name, quantity, unit, low_stock_threshold FROM raw_stock WHERE quantity <= low_stock_threshold;'
    },
    {
      tableName: 'customer_ledger_entries',
      rowCount: ledgerCount,
      columns: [
        { name: 'id', type: 'VARCHAR(64) (PK)' },
        { name: 'party_name', type: 'VARCHAR(255)' },
        { name: 'entry_date', type: 'VARCHAR(20)' },
        { name: 'debit', type: 'DECIMAL(12,2)' },
        { name: 'credit', type: 'DECIMAL(12,2)' },
        { name: 'payment_method', type: 'VARCHAR(50)' }
      ],
      sampleSQL: 'SELECT party_name, SUM(debit) - SUM(credit) AS net_balance FROM customer_ledger_entries GROUP BY party_name;'
    }
  ];
}

/**
 * Convenient alias for generating the full database ANSI SQL script
 */
export function generateFullDatabaseSQL(
  appState: AppState,
  projectId?: string,
  databaseId?: string,
  userEmail?: string
): string {
  return generateSQLDump(appState, userEmail, projectId, databaseId);
}

