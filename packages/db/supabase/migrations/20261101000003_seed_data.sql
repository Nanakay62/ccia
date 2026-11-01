-- Migration 20261101000003: Default Seed Data (Chart of Accounts, Funds, Sample Exchange Rate)

-- 1. Standard Church Funds
INSERT INTO funds (id, branch_id, code, name, type, description, allow_overdraft) VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'GEN', 'General Fund', 'Unrestricted', 'Main operational church fund', true),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'BLD', 'Building Fund', 'Restricted', 'Capital building project and infrastructure', false),
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'MIS', 'Missions & Outreach', 'Restricted', 'Evangelism, church planting and missionary support', false),
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'WEL', 'Welfare & Benevolence', 'Restricted', 'Support for needy church members and community care', false),
    ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'YTH', 'Youth Ministry', 'Restricted', 'Youth and teenage ministry activities', false)
ON CONFLICT (branch_id, code) DO NOTHING;

-- 2. Standard Church Chart of Accounts
-- Assets (1000-1999)
INSERT INTO accounts (id, branch_id, code, name, type, currency, is_bank_or_cash) VALUES
    ('20000000-0000-0000-0000-000000001010', '00000000-0000-0000-0000-000000000001', '1010', 'Cash on Hand (GHS)', 'Asset', 'GHS', true),
    ('20000000-0000-0000-0000-000000001020', '00000000-0000-0000-0000-000000000001', '1020', 'Cash on Hand (USD)', 'Asset', 'USD', true),
    ('20000000-0000-0000-0000-000000001030', '00000000-0000-0000-0000-000000000001', '1030', 'Bank Account (GHS)', 'Asset', 'GHS', true),
    ('20000000-0000-0000-0000-000000001040', '00000000-0000-0000-0000-000000000001', '1040', 'Bank Account (USD)', 'Asset', 'USD', true),
    ('20000000-0000-0000-0000-000000001050', '00000000-0000-0000-0000-000000000001', '1050', 'Mobile Money (MoMo) Wallet', 'Asset', 'GHS', true),
    ('20000000-0000-0000-0000-000000001500', '00000000-0000-0000-0000-000000000001', '1500', 'Fixed Assets (Equipment & Buildings)', 'Asset', 'GHS', false)
ON CONFLICT (branch_id, code) DO NOTHING;

-- Liabilities (2000-2999)
INSERT INTO accounts (id, branch_id, code, name, type, currency, is_bank_or_cash) VALUES
    ('20000000-0000-0000-0000-000000002010', '00000000-0000-0000-0000-000000000001', '2010', 'Accounts Payable', 'Liability', 'GHS', false),
    ('20000000-0000-0000-0000-000000002020', '00000000-0000-0000-0000-000000000001', '2020', 'Interfund Due To / Due From', 'Liability', 'GHS', false)
ON CONFLICT (branch_id, code) DO NOTHING;

-- Equity / Fund Balances (3000-3999)
INSERT INTO accounts (id, branch_id, code, name, type, currency, is_bank_or_cash) VALUES
    ('20000000-0000-0000-0000-000000003010', '00000000-0000-0000-0000-000000000001', '3010', 'General Fund Equity', 'Equity', 'GHS', false),
    ('20000000-0000-0000-0000-000000003020', '00000000-0000-0000-0000-000000000001', '3020', 'Building Fund Balance', 'Equity', 'GHS', false),
    ('20000000-0000-0000-0000-000000003030', '00000000-0000-0000-0000-000000000001', '3030', 'Missions Fund Balance', 'Equity', 'GHS', false),
    ('20000000-0000-0000-0000-000000003040', '00000000-0000-0000-0000-000000000001', '3040', 'Welfare Fund Balance', 'Equity', 'GHS', false),
    ('20000000-0000-0000-0000-000000003050', '00000000-0000-0000-0000-000000000001', '3050', 'Youth Fund Balance', 'Equity', 'GHS', false)
ON CONFLICT (branch_id, code) DO NOTHING;

-- Income Accounts (4000-4999)
INSERT INTO accounts (id, branch_id, code, name, type, currency, is_bank_or_cash) VALUES
    ('20000000-0000-0000-0000-000000004010', '00000000-0000-0000-0000-000000000001', '4010', 'Tithes', 'Income', 'GHS', false),
    ('20000000-0000-0000-0000-000000004020', '00000000-0000-0000-0000-000000000001', '4020', 'General Offerings', 'Income', 'GHS', false),
    ('20000000-0000-0000-0000-000000004030', '00000000-0000-0000-0000-000000000001', '4030', 'Special Offerings', 'Income', 'GHS', false),
    ('20000000-0000-0000-0000-000000004040', '00000000-0000-0000-0000-000000000001', '4040', 'Pledge Payments', 'Income', 'GHS', false),
    ('20000000-0000-0000-0000-000000004050', '00000000-0000-0000-0000-000000000001', '4050', 'Donations & Gifts', 'Income', 'GHS', false),
    ('20000000-0000-0000-0000-000000004060', '00000000-0000-0000-0000-000000000001', '4060', 'Rentals & Facility Income', 'Income', 'GHS', false),
    ('20000000-0000-0000-0000-000000004090', '00000000-0000-0000-0000-000000000001', '4090', 'Other Income', 'Income', 'GHS', false)
ON CONFLICT (branch_id, code) DO NOTHING;

-- Expense Accounts (5000-5999)
INSERT INTO accounts (id, branch_id, code, name, type, currency, is_bank_or_cash) VALUES
    ('20000000-0000-0000-0000-000000005010', '00000000-0000-0000-0000-000000000001', '5010', 'Salaries and Allowances', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005020', '00000000-0000-0000-0000-000000000001', '5020', 'Utilities (Electricity, Water, Internet)', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005030', '00000000-0000-0000-0000-000000000001', '5030', 'Maintenance & Repairs', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005040', '00000000-0000-0000-0000-000000000001', '5040', 'Outreach and Missions', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005050', '00000000-0000-0000-0000-000000000001', '5050', 'Welfare Support', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005060', '00000000-0000-0000-0000-000000000001', '5060', 'Church Events & Conferences', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005070', '00000000-0000-0000-0000-000000000001', '5070', 'Equipment & Instruments', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005080', '00000000-0000-0000-0000-000000000001', '5080', 'Admin, Office & Printing', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005090', '00000000-0000-0000-0000-000000000001', '5090', 'Transport & Fuel', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005980', '00000000-0000-0000-0000-000000000001', '5980', 'Foreign Exchange Gain/Loss', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005990', '00000000-0000-0000-0000-000000000001', '5990', 'Rounding Differences', 'Expense', 'GHS', false)
ON CONFLICT (branch_id, code) DO NOTHING;

-- 3. Initial Sample Exchange Rate for USD/GHS
INSERT INTO exchange_rates (id, branch_id, rate_date, currency, rate, notes) VALUES
    ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', CURRENT_DATE, 'USD', 15.5000, 'Initial benchmark market rate for USD/GHS')
ON CONFLICT (branch_id, rate_date, currency) DO NOTHING;
