#!/usr/bin/env python3
"""
Generate comprehensive Word (.docx) and PDF (.pdf) User Guides for the CCIA Church Accounting System.
"""

import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

DOCS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs"))
DOCX_PATH = os.path.join(DOCS_DIR, "Church_Accounting_System_User_Guide.docx")
PDF_PATH = os.path.join(DOCS_DIR, "Church_Accounting_System_User_Guide.pdf")

os.makedirs(DOCS_DIR, exist_ok=True)

# Shared Data Tables
ROLE_ROWS = [
    ("Pastor / Lead Minister", "Approve expense requisitions, inspect budgets, review high-level church financial statements.", "Names Masked (••••••••)"),
    ("Treasurer", "Disburse payment vouchers, calculate Ghana WHT, manage bank accounts, enter FX rates, lock accounting periods, run payroll.", "Full Access"),
    ("Finance Elder / Auditor", "Complete read-only audit access across all journal entries, counting sheets, bank reconciliations, and TB Doctor.", "Full Access"),
    ("Financial Secretary", "Manage 300 member profiles, envelope numbers (ENV-001 to ENV-300), pledge fulfillment, and tax statements.", "Full Access"),
    ("Counting Team (Volunteers)", "Record Sunday service physical cash piece counts, cheque tallies, MoMo float reconciliations, dual sign-off.", "Names Masked (MEM-***)"),
    ("Department Head", "Submit expense requisitions for youth, children, evangelism, media, or welfare against approved department budgets.", "No Giving Access"),
]

STEPS_COUNTING = [
    ("Step 1: Enter Secure Room", "Following the benediction, two unrelated counting team members enter the counting office and lock the door."),
    ("Step 2: Physical Piece Count", "Counters tally physical cash by individual denomination. For Ghana Cedis: GHS 200, 100, 50, 20, 10, 5, 2, 1, and 50 pesewas coins. For US Dollars: USD 100, 50, 20, 10, 5, 1. The software calculates exact totals automatically."),
    ("Step 3: Cheques & Mobile Money", "Enter all cheques with Drawer Name, Bank, Cheque Number, and Amount. Record MoMo collections (MTN MoMo, Telecel Cash, AT Money) with Transaction Reference IDs."),
    ("Step 4: Fund Allocations", "Specify how the total collection divides across church funds: General Fund (tithes and regular offering), Building Fund, Missions, and Welfare. Total allocations must exactly equal the cash + cheque + MoMo total."),
    ("Step 5: Dual Sign-Off", "Counter #1 signs on-screen and enters their PIN. Counter #2 independently verifies the cash, co-signs, and enters their PIN. The system blocks the same user from signing both slots."),
]

WHT_ROWS = [
    ("Professional Services & Contractors", "7.5% WHT", "Debit Expense for Gross, Credit WHT Payable (2020) for 7.5%, Credit Bank for 92.5%"),
    ("Goods, Supplies & Equipment", "3.0% WHT", "Debit Expense for Gross, Credit WHT Payable (2020) for 3.0%, Credit Bank for 97.0%"),
    ("Petty Cash / Internal Reimbursements", "0.0% (Exempt)", "Debit Expense for Gross, Credit Cash/Bank for 100%"),
]

CHECKS = [
    ("Rule 1: Mathematical Balance", "Verifies that total church-wide Debits equal total Credits in GHS."),
    ("Rule 2: Fund Balance", "Ensures that every fund (General, Building, Welfare, Missions) balances to zero independently."),
    ("Rule 3: Structural Integrity", "Scans for orphaned lines, headers without lines, or zero/negative amounts."),
    ("Rule 4: Sync Integrity", "Detects partial sync batches where lines present differ from header line_count."),
    ("Rule 5: Currency & Rounding", "Verifies base GHS equals USD x rate, flagging 1-pesewa rounding variances."),
    ("Rule 6: Duplicate Postings", "Flags duplicate transactions with matching date, amount, fund, and user within 15 minutes."),
    ("Rule 7: Pattern Detection", "Tests the remaining difference D: checks transposed digits (D divisible by 9), inverted debit/credit (D / 2), and decimal slips (10x, 100x)."),
    ("Rule 8: Time Bisect", "Pinpoints the exact calendar date when the ledger first went out of balance."),
    ("Rule 9: Source Breakdown", "Groups differences by user, physical device prefix, and document type."),
    ("Rule 10: Opening Balances", "Verifies that previous fiscal year carry-forward balances balance independently."),
]

FAQS = [
    ("Q: What should I do if the Trial Balance Doctor displays RED?",
     "A: Click 'Check & Diagnose Books' to read the Plain-Language Report. Check Rule 7 to see if a digit transposition occurred (e.g. entering 450 instead of 540) or if a debit was posted as a credit. Use the link to open the flagged entry and click 'Create Linked Reversal Entry' to mirror and correct it."),
    ("Q: Why does the system block me from signing both counting sheet slots?",
     "A: Internal control policies require two distinct, unrelated individuals to verify and sign Sunday cash counts. The second counter must log in with their own credentials."),
    ("Q: How do we handle foreign currency donations given in US Dollars?",
     "A: Record the USD amount under the USD cash denomination section. The system records the original USD amount and converts it to GHS using the active exchange rate. At month-end, run Foreign Currency Revaluation to recognize any exchange gains or losses."),
    ("Q: What if our church laptop's screen is locked and the PIN is entered wrong 5 times?",
     "A: The keypad locks for 30 seconds to prevent brute-force attacks. Wait 30 seconds for the cooldown timer to expire, then re-enter the correct PIN."),
]


# ==============================================================================
# 1. BUILD MICROSOFT WORD (.DOCX) MANUAL
# ==============================================================================

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>'))

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def create_docx_manual():
    print("Building Word (.docx) User Guide...")
    doc = Document()

    # Set 1-inch margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Styles
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Roboto'
    normal_style.font.size = Pt(10.5)
    normal_style.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    normal_style.paragraph_format.line_spacing = 1.15
    normal_style.paragraph_format.space_after = Pt(6)

    # Cover Page
    cover_title = doc.add_paragraph()
    cover_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cover_title.paragraph_format.space_before = Pt(80)
    run_org = cover_title.add_run("CHURCH OF CHRIST INTERNATIONAL, ACCRA\n")
    run_org.font.size = Pt(13)
    run_org.font.bold = True
    run_org.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    run_suborg = cover_title.add_run("Accra Central Branch • Financial Administration Office\n\n")
    run_suborg.font.size = Pt(11)
    run_suborg.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

    run_main = cover_title.add_run("OFFICIAL USER & OPERATIONAL MANUAL\n")
    run_main.font.size = Pt(24)
    run_main.font.bold = True
    run_main.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

    run_desc = cover_title.add_run("Offline-First Progressive Web App for Church Fund Accounting\n\n")
    run_desc.font.size = Pt(13)
    run_desc.font.italic = True
    run_desc.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)

    doc.add_paragraph().paragraph_format.space_after = Pt(120)

    # Metadata Box on Cover
    meta_table = doc.add_table(rows=4, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ("Base Currency:", "Ghana Cedis (GHS) with USD Reporting View"),
        ("System Architecture:", "Offline-First Local SQLite with PowerSync & Supabase"),
        ("Audience:", "Treasurers, Pastors, Elders, Financial Secretaries, Counters"),
        ("Version & Date:", "Release 1.0 • November 2026 Edition"),
    ]
    for row_idx, (k, v) in enumerate(meta_data):
        row = meta_table.rows[row_idx]
        row.cells[0].paragraphs[0].add_run(k).bold = True
        row.cells[0].paragraphs[0].runs[0].font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
        row.cells[1].paragraphs[0].add_run(v)
        row.cells[0].width = Inches(2.2)
        row.cells[1].width = Inches(4.3)
        set_cell_margins(row.cells[0], top=80, bottom=80, left=100, right=100)
        set_cell_margins(row.cells[1], top=80, bottom=80, left=100, right=100)
        set_cell_background(row.cells[0], "F1F5F9")
        set_cell_background(row.cells[1], "F8FAFC")

    doc.add_page_break()

    # Table of Contents
    toc_p = doc.add_paragraph()
    toc_p.paragraph_format.space_before = Pt(10)
    toc_p.paragraph_format.space_after = Pt(14)
    run_toc_h = toc_p.add_run("Table of Contents")
    run_toc_h.font.size = Pt(18)
    run_toc_h.font.bold = True
    run_toc_h.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

    toc_items = [
        ("Section 1", "Introduction, Accounting Model & Architecture", "3"),
        ("Section 2", "User Roles, Permissions & Security Hardening", "4"),
        ("Section 3", "Executive Financial Administration Dashboard", "6"),
        ("Section 4", "Sunday Giving & Dual-Custody Counting Sheets", "8"),
        ("Section 5", "Expenditure, Requisitions & Payment Vouchers (GRA WHT)", "10"),
        ("Section 6", "Church Staff Payroll & Ghana Statutory Taxes (SSNIT & PAYE)", "12"),
        ("Section 7", "Member Giving Directory, Pledges & Official Statements", "14"),
        ("Section 8", "Month-End Closing & Foreign Exchange (USD) Revaluation", "16"),
        ("Section 9", "Trial Balance Doctor & Ledger Integrity Diagnostics", "18"),
        ("Section 10", "Offline Operation, Network Syncing & Encrypted Backups", "20"),
        ("Section 11", "Demo Mode (300 Members & 26 Weeks Historical Data)", "22"),
        ("Section 12", "Practical Step-by-Step Scenarios & Frequently Asked Questions", "23"),
    ]

    toc_table = doc.add_table(rows=len(toc_items), cols=3)
    toc_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for idx, (sec, title, page) in enumerate(toc_items):
        row = toc_table.rows[idx]
        p0 = row.cells[0].paragraphs[0]
        p0.add_run(sec).bold = True
        p0.runs[0].font.color.rgb = RGBColor(0x25, 0x63, 0xEB)
        p1 = row.cells[1].paragraphs[0]
        p1.add_run(title)
        p2 = row.cells[2].paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p2.add_run(f"Page {page}")
        row.cells[0].width = Inches(1.3)
        row.cells[1].width = Inches(4.5)
        row.cells[2].width = Inches(1.0)
        set_cell_margins(row.cells[0], top=60, bottom=60, left=80, right=80)
        set_cell_margins(row.cells[1], top=60, bottom=60, left=80, right=80)
        set_cell_margins(row.cells[2], top=60, bottom=60, left=80, right=80)
        bg = "FFFFFF" if idx % 2 == 0 else "F8FAFC"
        set_cell_background(row.cells[0], bg)
        set_cell_background(row.cells[1], bg)
        set_cell_background(row.cells[2], bg)

    doc.add_page_break()

    def add_section_header(num, title):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(18)
        h.paragraph_format.space_after = Pt(6)
        r_num = h.add_run(f"{num}: ")
        r_num.font.size = Pt(14)
        r_num.font.bold = True
        r_num.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)
        r_title = h.add_run(title)
        r_title.font.size = Pt(14)
        r_title.font.bold = True
        r_title.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

    def add_callout(text, title="NOTE"):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl.cell(0, 0)
        cell.width = Inches(6.8)
        set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
        set_cell_background(cell, "EFF6FF")
        p = cell.paragraphs[0]
        r_head = p.add_run(f"[{title}] ")
        r_head.bold = True
        r_head.font.color.rgb = RGBColor(0x1D, 0x4E, 0xD8)
        r_body = p.add_run(text)
        r_body.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
        p.paragraph_format.space_after = Pt(2)
        doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # Section 1
    add_section_header("Section 1", "Introduction, Accounting Model & Architecture")
    doc.add_paragraph(
        "The CCIA Church Accounting System is an enterprise-grade, offline-first Progressive Web App (PWA) "
        "designed specifically for the financial administration of our local congregation in Accra, Ghana. "
        "It provides rigorous financial governance, segregation of duties, multi-fund tracking, and full compliance "
        "with standard double-entry bookkeeping."
    )
    p = doc.add_paragraph(style='List Bullet')
    p.add_run("Base Currency in Ghana Cedis (GHS): ").bold = True
    p.add_run("All primary ledger accounts, cash on hand, bank accounts, and payroll records are denominated in GHS pesewas. Foreign currency receipts (USD cash, international cheques, foreign pledges) are recorded with their original currency, exchange rate, and base GHS conversion.")

    p = doc.add_paragraph(style='List Bullet')
    p.add_run("USD Denominational Reporting View: ").bold = True
    p.add_run("The denomination requires an executive USD summary. Rather than running an error-prone second set of books, the system converts GHS statements at the prevailing period closing rate or average rate, clearly indicating translation parameters.")

    p = doc.add_paragraph(style='List Bullet')
    p.add_run("True Offline-First SQLite Engine: ").bold = True
    p.add_run("Church operations frequently encounter unreliable internet in Accra. The system embeds a complete SQLite database directly on each client device. Adding vouchers, counting Sunday collections, running payroll, and viewing financial statements run locally in < 15ms without internet.")

    p = doc.add_paragraph(style='List Bullet')
    p.add_run("Zero-Trust Server-Side Enforcement: ").bold = True
    p.add_run("Client devices are never trusted to enforce accounting rules. PostgreSQL database triggers and deferred constraints reject unbalanced postings, unauthorized fund overdrafts, or postings into closed periods.")

    add_callout(
        "All monetary values are calculated in integer minor units (pesewas/cents) using Banker's Rounding (Round to Nearest Even). Floating-point math is strictly prohibited to eliminate 1-pesewa calculation drift.",
        title="ACCOUNTING PRINCIPLE"
    )

    # Section 2
    add_section_header("Section 2", "User Roles, Permissions & Security Hardening")
    doc.add_paragraph(
        "The system enforces strict Segregation of Duties. No single individual can count cash, authorize expenses, and disburse church funds alone."
    )

    role_table = doc.add_table(rows=7, cols=3)
    role_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    role_headers = ["User Role", "Permitted Responsibilities", "Giving Privacy Level"]
    for i, h in enumerate(role_headers):
        cell = role_table.cell(0, i)
        cell.paragraphs[0].add_run(h).bold = True
        cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, top=100, bottom=100, left=120, right=120)

    for r_idx, (r, resp, priv) in enumerate(ROLE_ROWS, start=1):
        row = role_table.rows[r_idx]
        row.cells[0].paragraphs[0].add_run(r).bold = True
        row.cells[1].paragraphs[0].add_run(resp)
        row.cells[2].paragraphs[0].add_run(priv)
        row.cells[0].width = Inches(2.0)
        row.cells[1].width = Inches(3.2)
        row.cells[2].width = Inches(1.6)
        bg = "FFFFFF" if r_idx % 2 == 1 else "F8FAFC"
        for c in row.cells:
            set_cell_background(c, bg)
            set_cell_margins(c, top=80, bottom=80, left=100, right=100)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    doc.add_paragraph(
        "Security & PIN Lockout Feature:\n"
        "To protect unattended laptops and tablets in the church office, the screen locks after 5 minutes of inactivity. "
        "Users authenticate using their personal 4-digit PIN. If an incorrect PIN is entered 5 consecutive times, "
        "the application automatically triggers a 30-second security lockout cooldown, disabling the keypad to defeat brute-force guessing."
    )

    # Section 3
    add_section_header("Section 3", "Executive Financial Administration Dashboard")
    doc.add_paragraph(
        "The Dashboard serves as the central command console for the church's executive leadership. It provides real-time "
        "financial visibility across four primary areas:"
    )
    p = doc.add_paragraph(style='List Bullet')
    p.add_run("Executive KPI Cards: ").bold = True
    p.add_run("Displays Total Giving & Income (with converted USD equivalent badge), Total Expenditures (including Ghana GRA WHT), Net Operating Surplus (with green operating margin indicator), and Liquid Cash & Bank reserves.")

    p = doc.add_paragraph(style='List Bullet')
    p.add_run("Fund Integrity & Restricted Capital Protection: ").bold = True
    p.add_run("Visualizes the allocation between Unrestricted Capital (General Fund) and Restricted Capital (Building, Missions, Welfare). A dynamic progress bar alerts leaders to the proportion of restricted funds held, preventing illegal diversion into operational overhead.")

    p = doc.add_paragraph(style='List Bullet')
    p.add_run("Individual Fund Breakdown: ").bold = True
    p.add_run("Displays current balances for General Fund [GEN], Building Fund [BLD], Missions & Outreach [MIS], Welfare & Benevolence [WEL], and Youth Ministry [YTH].")

    p = doc.add_paragraph(style='List Bullet')
    p.add_run("Quick Operations Launchpad: ").bold = True
    p.add_run("One-click interactive cards for Counting Sheet, Payment Voucher, Financial Reports, and Ledger Integrity Diagnostics.")

    # Section 4
    add_section_header("Section 4", "Sunday Giving & Dual-Custody Counting Sheets")
    doc.add_paragraph(
        "Sunday collections are the lifeblood of church operations. To ensure total transparency and protect volunteers "
        "from accusations of mishandling, a strict four-step dual-custody counting workflow is enforced:"
    )
    for s_title, s_desc in STEPS_COUNTING:
        p = doc.add_paragraph(style='List Bullet')
        p.add_run(f"{s_title}: ").bold = True
        p.add_run(s_desc)

    add_callout(
        "Upon the second counter's co-signature, the sheet status moves to POSTED, instantly generating balanced double-entry journal entries debiting Cash/Bank and crediting Fund Income accounts, while producing an official Bank Deposit Slip.",
        title="AUTOMATIC POSTING"
    )

    # Section 5
    add_section_header("Section 5", "Expenditure, Requisitions & Payment Vouchers (GRA WHT)")
    doc.add_paragraph(
        "Church funds are disbursed following a three-tier approval workflow with statutory Ghana Revenue Authority (GRA) Withholding Tax deduction."
    )
    wht_table = doc.add_table(rows=4, cols=3)
    wht_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    wht_headers = ["Expense Category", "Ghana GRA WHT Rate", "Accounting Treatment"]
    for i, h in enumerate(wht_headers):
        cell = wht_table.cell(0, i)
        cell.paragraphs[0].add_run(h).bold = True
        cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, top=100, bottom=100, left=120, right=120)

    for r_idx, (cat, rate, trt) in enumerate(WHT_ROWS, start=1):
        row = wht_table.rows[r_idx]
        row.cells[0].paragraphs[0].add_run(cat).bold = True
        row.cells[1].paragraphs[0].add_run(rate)
        row.cells[2].paragraphs[0].add_run(trt)
        row.cells[0].width = Inches(2.2)
        row.cells[1].width = Inches(1.3)
        row.cells[2].width = Inches(3.3)
        bg = "FFFFFF" if r_idx % 2 == 1 else "F8FAFC"
        for c in row.cells:
            set_cell_background(c, bg)
            set_cell_margins(c, top=80, bottom=80, left=100, right=100)

    # Section 6
    add_section_header("Section 6", "Church Staff Payroll & Ghana Statutory Taxes")
    doc.add_paragraph(
        "The payroll module automates monthly staff compensation in accordance with Ghanaian labour law and GRA regulations."
    )
    p = doc.add_paragraph(style='List Bullet')
    p.add_run("SSNIT Tier 1 (13.5%): ").bold = True
    p.add_run("Employer statutory contribution remitted directly to the Social Security and National Insurance Trust.")

    p = doc.add_paragraph(style='List Bullet')
    p.add_run("SSNIT Tier 2 (5.5%): ").bold = True
    p.add_run("Employee mandatory contribution deducted from gross pay and remitted to the approved private occupational pension scheme.")

    p = doc.add_paragraph(style='List Bullet')
    p.add_run("GRA PAYE Progressive Tax: ").bold = True
    p.add_run("Calculated automatically on taxable income using Ghana Revenue Authority progressive income tax brackets.")

    # Section 7
    add_section_header("Section 7", "Member Giving Directory, Pledges & Official Statements")
    doc.add_paragraph(
        "Maintains a confidential registry of church members with envelope numbers (ENV-001 through ENV-300). "
        "Volunteers and department heads only see masked identifiers (MEM-042), while authorized finance officers "
        "can view member names, giving history, and pledge progress."
    )
    p = doc.add_paragraph(style='List Bullet')
    p.add_run("Pledge Tracking: ").bold = True
    p.add_run("Monitors dedicated pledges toward the Church Building Expansion and Welfare Fund with real-time percentage fulfillment bars.")

    p = doc.add_paragraph(style='List Bullet')
    p.add_run("Official Annual Statements & Tax Receipts: ").bold = True
    p.add_run("Generate formatted PDF giving statements bearing official church letterhead, branch details, category totals, and auditor sign-off.")

    # Section 8
    add_section_header("Section 8", "Month-End Closing & Foreign Exchange (USD) Revaluation")
    doc.add_paragraph("Month-End Routine Steps:")
    doc.add_paragraph("1. Run Trial Balance Doctor to confirm all 10 integrity checks are green.\n"
                      "2. Enter official Bank of Ghana month-end closing exchange rate (USD to GHS).\n"
                      "3. Run Revaluation Preview: The software calculates unrealized gain or loss on foreign cash and USD bank accounts.\n"
                      "4. Post Revaluation Entry: Automatically creates a journal entry posting the difference to Account 5980 Foreign Exchange Gain/Loss.\n"
                      "5. Lock the Accounting Period: Prevents any user from adding, editing, or deleting postings in the closed month.")

    # Section 9
    add_section_header("Section 9", "Trial Balance Doctor & Ledger Integrity Diagnostics")
    doc.add_paragraph(
        "The Trial Balance Doctor executes 10 sequential checks to verify ledger integrity:"
    )
    for r_name, r_desc in CHECKS:
        p = doc.add_paragraph(style='List Bullet')
        p.add_run(f"{r_name}: ").bold = True
        p.add_run(r_desc)

    add_callout(
        "The Doctor adheres to a strict Never Auto-Fix Policy. Silent automated corrections corrupt accounting audits. The Doctor presents clear evidence and guides the Treasurer to post a linked reversal.",
        title="NEVER AUTO-FIX"
    )

    # Section 10
    add_section_header("Section 10", "Offline Operation, Network Syncing & Encrypted Backups")
    doc.add_paragraph(
        "When internet drops, the top navigation pill displays 'Offline Mode (N entries queued)'. "
        "Users can continue to enter counting sheets, issue vouchers, and view reports without interruption. "
        "When the device reconnects to Wi-Fi or mobile data, the PowerSync engine automatically drains the queue, "
        "uploading changes and downloading updates made on other church devices."
    )
    doc.add_paragraph(
        "Manual Encrypted Backups (.ccbk):\n"
        "To protect against hardware loss or theft, go to Settings -> Backup & Security, enter a 10+ character passphrase, "
        "and click 'Download Encrypted Backup (.ccbk)'. The system creates an AES-256 encrypted file containing all chart of accounts, "
        "funds, journal entries, and members. In an emergency, this file can be restored on any new device."
    )

    # Section 11
    add_section_header("Section 11", "Demo Mode (300 Members & 26 Weeks Historical Data)")
    doc.add_paragraph(
        "To train new accounting staff or demonstrate the software to church elders, activate Demo Mode by clicking "
        "the 'Demo Mode' toggle in the top header. This loads 300 authentic Ghanaian members (Akan, Ga, Ewe, Northern names, "
        "ENV-001 through ENV-300) and 26 weeks of historical collections, payroll, and vouchers in an isolated in-memory sandbox."
    )

    # Section 12
    add_section_header("Section 12", "Practical Step-by-Step Scenarios & Frequently Asked Questions")
    for q, a in FAQS:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after = Pt(4)
        p.add_run(q).bold = True
        p.runs[0].font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
        doc.add_paragraph(a)

    doc.save(DOCX_PATH)
    print(f"Word guide saved successfully: {DOCX_PATH}")


# ==============================================================================
# 2. BUILD ADOBE PDF (.PDF) MANUAL
# ==============================================================================

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_header_footer(self, page_count):
        if self._pageNumber == 1:
            return

        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#1E3A8A"))
        self.drawString(54, 755, "CHURCH OF CHRIST INTERNATIONAL, ACCRA")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(54, 745, "Accounting System User & Operational Manual — Release 1.0")

        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(54, 738, 558, 738)

        self.line(54, 45, 558, 45)
        self.setFont("Helvetica", 8)
        self.drawString(54, 32, "Confidential — Internal Church Administration Use Only")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 32, page_str)
        self.restoreState()


def create_pdf_manual():
    print("Building Adobe PDF (.pdf) User Guide...")
    pdf_doc = SimpleDocTemplate(
        PDF_PATH,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#0F172A"),
        alignment=1,
        spaceAfter=12
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#1E3A8A"),
        alignment=1,
        spaceAfter=6
    )

    desc_style = ParagraphStyle(
        'CoverDesc',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#2563EB"),
        alignment=1,
        spaceAfter=24
    )

    h1_style = ParagraphStyle(
        'SecHeading',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#1E3A8A"),
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#334155"),
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'BulletText',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B")
    )

    story = []

    # Cover Page
    story.append(Spacer(1, 40))
    story.append(Paragraph("CHURCH OF CHRIST INTERNATIONAL, ACCRA", subtitle_style))
    story.append(Paragraph("Accra Central Branch • Financial Administration Office", ParagraphStyle('SubSub', parent=subtitle_style, fontName='Helvetica', fontSize=10, textColor=colors.HexColor("#64748B"))))
    story.append(Spacer(1, 20))
    story.append(Paragraph("OFFICIAL USER &amp; OPERATIONAL MANUAL", title_style))
    story.append(Paragraph("Offline-First Progressive Web App for Church Fund Accounting", desc_style))
    story.append(Spacer(1, 80))

    meta_table_data = [
        [Paragraph("<b>Base Currency:</b>", body_style), Paragraph("Ghana Cedis (GHS) with USD Reporting View", body_style)],
        [Paragraph("<b>System Architecture:</b>", body_style), Paragraph("Offline-First Local SQLite with PowerSync &amp; Supabase", body_style)],
        [Paragraph("<b>Target Audience:</b>", body_style), Paragraph("Treasurers, Pastors, Elders, Financial Secretaries, Counting Volunteers", body_style)],
        [Paragraph("<b>Software Release:</b>", body_style), Paragraph("Release 1.0 • November 2026 Production Edition", body_style)],
    ]
    t_meta = Table(meta_table_data, colWidths=[150, 350])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
        ('BACKGROUND', (1, 0), (1, -1), colors.HexColor("#F8FAFC")),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(t_meta)
    story.append(PageBreak())

    # Table of Contents
    story.append(Paragraph("Table of Contents", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2563EB"), spaceBefore=2, spaceAfter=8))

    toc_pdf_items = [
        ("Section 1", "Introduction, Accounting Model & Architecture", "3"),
        ("Section 2", "User Roles, Permissions & Security Hardening", "4"),
        ("Section 3", "Executive Financial Administration Dashboard", "5"),
        ("Section 4", "Sunday Giving & Dual-Custody Counting Sheets", "6"),
        ("Section 5", "Expenditure, Requisitions & Payment Vouchers (GRA WHT)", "7"),
        ("Section 6", "Church Staff Payroll & Ghana Statutory Taxes (SSNIT & PAYE)", "8"),
        ("Section 7", "Member Giving Directory, Pledges & Official Statements", "9"),
        ("Section 8", "Month-End Closing & Foreign Exchange (USD) Revaluation", "10"),
        ("Section 9", "Trial Balance Doctor & Ledger Integrity Diagnostics", "11"),
        ("Section 10", "Offline Operation, Network Syncing & Encrypted Backups", "12"),
        ("Section 11", "Demo Mode (300 Members & 26 Weeks Historical Data)", "13"),
        ("Section 12", "Practical Step-by-Step Scenarios & Frequently Asked Questions", "14"),
    ]
    toc_pdf_data = []
    for sec, title, page in toc_pdf_items:
        toc_pdf_data.append([
            Paragraph(f"<b>{sec}</b>", ParagraphStyle('TOCSec', parent=body_style, textColor=colors.HexColor("#2563EB"))),
            Paragraph(title, body_style),
            Paragraph(f"Page {page}", ParagraphStyle('TOCPage', parent=body_style, alignment=2, textColor=colors.HexColor("#64748B")))
        ])
    t_toc = Table(toc_pdf_data, colWidths=[90, 340, 70])
    t_toc.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_toc)
    story.append(PageBreak())

    def pdf_callout(text, label="NOTE"):
        t_data = [[Paragraph(f"<b>[{label}]</b> {text}", callout_style)]]
        t = Table(t_data, colWidths=[500])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#93C5FD")),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ]))
        return t

    # Section 1
    story.append(Paragraph("Section 1: Introduction, Accounting Model & Architecture", h1_style))
    story.append(Paragraph(
        "The CCIA Church Accounting System is an enterprise-grade, offline-first Progressive Web App (PWA) "
        "designed specifically for the financial administration of our local congregation in Accra, Ghana. "
        "It provides rigorous financial governance, segregation of duties, multi-fund tracking, and full compliance "
        "with standard double-entry bookkeeping.", body_style
    ))
    story.append(Paragraph("<b>Key Architectural Principles:</b>", body_style))
    story.append(Paragraph("• <b>Base Currency in Ghana Cedis (GHS):</b> All primary ledger accounts, cash on hand, bank accounts, and payroll records are denominated in GHS pesewas. Foreign currency receipts are stored with original currency and exchange rate.", bullet_style))
    story.append(Paragraph("• <b>USD Denominational Reporting View:</b> The denomination requires an executive USD summary. Rather than running an error-prone second set of books, the system converts GHS statements at the prevailing period closing rate or average rate.", bullet_style))
    story.append(Paragraph("• <b>True Offline-First SQLite Engine:</b> Church operations frequently encounter unreliable internet in Accra. The system embeds a complete SQLite database directly on each client device. Queries execute in under 15ms offline.", bullet_style))
    story.append(Paragraph("• <b>Zero-Trust Server-Side Enforcement:</b> PostgreSQL database triggers and deferred constraints reject unbalanced postings, unauthorized fund overdrafts, or postings into closed periods.", bullet_style))
    story.append(Spacer(1, 4))
    story.append(pdf_callout("All monetary values are calculated in integer minor units (pesewas/cents) using Banker's Rounding (Round to Nearest Even) to eliminate 1-pesewa calculation drift.", label="ACCOUNTING PRINCIPLE"))
    story.append(Spacer(1, 10))

    # Section 2
    story.append(Paragraph("Section 2: User Roles, Permissions & Security Hardening", h1_style))
    story.append(Paragraph(
        "The system enforces strict Segregation of Duties. No single individual can count cash, authorize expenses, and disburse church funds alone.", body_style
    ))
    pdf_role_data = [
        [Paragraph("<b>User Role</b>", ParagraphStyle('Hdr', parent=body_style, textColor=colors.white)),
         Paragraph("<b>Permitted Responsibilities</b>", ParagraphStyle('Hdr', parent=body_style, textColor=colors.white)),
         Paragraph("<b>Giving Privacy</b>", ParagraphStyle('Hdr', parent=body_style, textColor=colors.white))]
    ]
    for r, resp, priv in ROLE_ROWS:
        pdf_role_data.append([
            Paragraph(f"<b>{r}</b>", body_style),
            Paragraph(resp, body_style),
            Paragraph(priv, body_style)
        ])
    t_roles = Table(pdf_role_data, colWidths=[130, 250, 120])
    t_roles.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_roles)
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Security PIN & Lockout:</b> The screen automatically locks after 5 minutes of inactivity. "
        "Entering an incorrect PIN 5 consecutive times triggers a 30-second lockout cooldown, defeating automated brute-force attacks.", body_style
    ))
    story.append(Spacer(1, 10))

    # Section 3
    story.append(Paragraph("Section 3: Executive Financial Administration Dashboard", h1_style))
    story.append(Paragraph("The Dashboard presents four critical areas:", body_style))
    story.append(Paragraph("• <b>Executive KPI Cards:</b> Total Giving &amp; Income (with converted USD badge), Total Expenditures (including Ghana WHT), Net Operating Surplus (with margin status), and Liquid Cash &amp; Bank reserves.", bullet_style))
    story.append(Paragraph("• <b>Fund Integrity &amp; Restricted Capital Protection:</b> Dynamic progress bar showing Unrestricted (General Fund) vs Restricted (Building, Missions, Welfare) capital, preventing illegal diversion of donor-restricted gifts.", bullet_style))
    story.append(Paragraph("• <b>Individual Fund Breakdown:</b> Live balances for General [GEN], Building [BLD], Missions [MIS], Welfare [WEL], and Youth [YTH].", bullet_style))
    story.append(Paragraph("• <b>Quick Operations Launchpad:</b> Fast shortcuts for Counting Sheets, Payment Vouchers, Financial Reports, and Ledger Integrity Diagnostics.", bullet_style))
    story.append(Spacer(1, 10))

    # Section 4
    story.append(Paragraph("Section 4: Sunday Giving & Dual-Custody Counting Sheets", h1_style))
    story.append(Paragraph("Sunday collections follow a strict dual-custody procedure:", body_style))
    for s_title, s_desc in STEPS_COUNTING:
        story.append(Paragraph(f"• <b>{s_title}:</b> {s_desc}", bullet_style))
    story.append(Spacer(1, 4))
    story.append(pdf_callout("Co-signing the sheet moves it to POSTED, instantly creating balanced journal entries and generating an official Bank Deposit Slip.", label="AUTOMATIC POSTING"))
    story.append(Spacer(1, 10))

    # Section 5
    story.append(Paragraph("Section 5: Expenditure, Requisitions & Payment Vouchers (GRA WHT)", h1_style))
    story.append(Paragraph("Ghana Revenue Authority Withholding Tax (WHT) rates are computed automatically:", body_style))
    pdf_wht_data = [
        [Paragraph("<b>Category</b>", ParagraphStyle('Hdr', parent=body_style, textColor=colors.white)),
         Paragraph("<b>GRA WHT Rate</b>", ParagraphStyle('Hdr', parent=body_style, textColor=colors.white)),
         Paragraph("<b>Accounting Treatment</b>", ParagraphStyle('Hdr', parent=body_style, textColor=colors.white))]
    ]
    for cat, rate, trt in WHT_ROWS:
        pdf_wht_data.append([
            Paragraph(f"<b>{cat}</b>", body_style),
            Paragraph(rate, body_style),
            Paragraph(trt, body_style)
        ])
    t_wht = Table(pdf_wht_data, colWidths=[150, 90, 260])
    t_wht.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_wht)
    story.append(Spacer(1, 10))

    # Section 6
    story.append(Paragraph("Section 6: Church Staff Payroll & Ghana Statutory Taxes", h1_style))
    story.append(Paragraph("Monthly payroll complies fully with Ghana labour regulations:", body_style))
    story.append(Paragraph("• <b>SSNIT Tier 1 (13.5%):</b> Employer mandatory statutory contribution remitted to SSNIT.", bullet_style))
    story.append(Paragraph("• <b>SSNIT Tier 2 (5.5%):</b> Employee mandatory contribution deducted from gross stipend and remitted to the occupational scheme trustee.", bullet_style))
    story.append(Paragraph("• <b>GRA PAYE:</b> Calculated using GRA's progressive tax bands. Produces printable PDF payslips for pastors and office staff.", bullet_style))
    story.append(Spacer(1, 10))

    # Section 7
    story.append(Paragraph("Section 7: Member Giving Directory, Pledges & Official Statements", h1_style))
    story.append(Paragraph("Confidential member directory tracking 300 church members with envelope numbers (ENV-001 to ENV-300).", body_style))
    story.append(Paragraph("• <b>Pledge Tracking:</b> Monitors dedicated capital campaigns (e.g. Building Fund Expansion) with real-time progress bars.", bullet_style))
    story.append(Paragraph("• <b>Tax Statements & Receipts:</b> Generate official annual PDF statements bearing church letterhead and signature blocks offline.", bullet_style))
    story.append(Spacer(1, 10))

    # Section 8
    story.append(Paragraph("Section 8: Month-End Closing & Foreign Exchange (USD) Revaluation", h1_style))
    story.append(Paragraph("Month-End Routine Steps:", body_style))
    story.append(Paragraph("1. Run Trial Balance Doctor to confirm books are green.<br/>"
                           "2. Enter official Bank of Ghana month-end closing exchange rate.<br/>"
                           "3. Run Revaluation Preview to calculate unrealized FX gain or loss on USD holdings.<br/>"
                           "4. Post revaluation entry to Account 5980 Foreign Exchange Gain/Loss.<br/>"
                           "5. Lock the accounting period to permanently freeze the month against changes.", body_style))
    story.append(Spacer(1, 4))
    story.append(pdf_callout("Closed periods cannot receive new postings. Corrections must be posted in the open active period via a linked reversal.", label="IMMUTABILITY RULE"))
    story.append(Spacer(1, 10))

    # Section 9
    story.append(Paragraph("Section 9: Trial Balance Doctor & Ledger Integrity Diagnostics", h1_style))
    story.append(Paragraph("The Doctor runs 10 sequential diagnostic tests:", body_style))
    for r_name, r_desc in CHECKS:
        story.append(Paragraph(f"• <b>{r_name}:</b> {r_desc}", bullet_style))
    story.append(Spacer(1, 4))
    story.append(pdf_callout("Strict Never Auto-Fix Policy: Silent corrections undermine audits. The Doctor presents evidence and recommends linked reversal entries.", label="NEVER AUTO-FIX"))
    story.append(Spacer(1, 10))

    # Section 10
    story.append(Paragraph("Section 10: Offline Operation, Network Syncing & Encrypted Backups", h1_style))
    story.append(Paragraph("• <b>Offline Autonomy:</b> All transactions queue locally on SQLite. When reconnecting to Wi-Fi/MoMo, PowerSync uploads queued changes automatically.", bullet_style))
    story.append(Paragraph("• <b>Encrypted Backups (.ccbk):</b> Treasurers can download an AES-256 encrypted backup archive with a passphrase. In disaster scenarios, this bundle restores all ledgers and members completely.", bullet_style))
    story.append(Spacer(1, 10))

    # Section 11
    story.append(Paragraph("Section 11: Demo Mode (300 Members & 26 Weeks Historical Data)", h1_style))
    story.append(Paragraph("• <b>300 Ghanaian Members:</b> Authentic Akan, Ga, Ewe, Northern names, envelope numbers ENV-001 through ENV-300 across 8 ministries.", bullet_style))
    story.append(Paragraph("• <b>26 Weeks of Worship Services:</b> Balanced Sunday collections, cheques, MoMo, building pledges, payroll runs, and utilities.", bullet_style))
    story.append(Paragraph("• <b>Zero Risk to Live Books:</b> All demo operations run in an in-memory sandbox without touching live church records.", bullet_style))
    story.append(Spacer(1, 10))

    # Section 12
    story.append(Paragraph("Section 12: Practical Step-by-Step Scenarios & Frequently Asked Questions", h1_style))
    for q, a in FAQS:
        story.append(Paragraph(f"<b>{q}</b>", ParagraphStyle('Q', parent=body_style, fontName='Helvetica-Bold', textColor=colors.HexColor("#1E3A8A"))))
        story.append(Paragraph(a, body_style))
        story.append(Spacer(1, 3))

    pdf_doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Adobe PDF guide saved successfully: {PDF_PATH}")


if __name__ == "__main__":
    create_docx_manual()
    create_pdf_manual()
    print("All user documentation generated successfully.")
