/**
 * Canonical Data Content for the CCIA Church Accounting Platform User Manual.
 */

export interface UserManualChapter {
  id: string;
  number: string;
  title: string;
  contentHtml: string;
}

export const USER_MANUAL_CHAPTERS: UserManualChapter[] = [
  {
    id: 'overview',
    number: '1',
    title: 'System Overview & Core Accounting Architecture',
    contentHtml: `
      <h3>1.1 Purpose of the Platform</h3>
      <p>The <strong>CCIA Church Accounting Software</strong> is a purpose-built, offline-first financial management system tailored specifically for church administration, Ghanaian statutory tax compliance (GRA, SSNIT), and international dual-currency reporting (GHS / USD). Designed to embody the precision and calm trustworthiness of a traditional physical ledger book, the system eliminates decorative SaaS clutter in favor of clean rules, tabular figures, and strict accounting rigor.</p>

      <h3>1.2 Fundamental Double-Entry Accounting Invariant</h3>
      <p>Every transaction posted in the system strictly satisfies the classical double-entry accounting identity:</p>
      <div style="background-color: #f8fafc; border-left: 4px solid #1e4620; padding: 10px 14px; margin: 12px 0; font-family: monospace; font-size: 11pt; font-weight: bold;">
        Total Debits (Dr) = Total Credits (Cr)
      </div>
      <p>The system prevents any single-sided or unbalanced transaction from ever entering the general ledger. For multi-currency entries, balance is enforced in both the transaction currency and the local reporting currency (Ghana Cedis).</p>

      <h3>1.3 Append-Only Immutable Ledger (No Deletions)</h3>
      <p>In accordance with international accounting standards (IFRS) and anti-fraud church governance:</p>
      <ul>
        <li><strong>No DELETE Operations:</strong> Once an entry is committed, it can never be deleted from the database.</li>
        <li><strong>No IN-PLACE EDITING:</strong> Posted vouchers, counting sheets, and journal lines cannot have amounts or accounts modified after posting.</li>
        <li><strong>Linked Reversal Entries:</strong> If an error is identified, an authorized user must post an exact mirror reversal entry. The reversal preserves a permanent audit trail, recording the original document number, reversal reason, and user ID.</li>
      </ul>

      <h3>1.4 Church Fund Accounting (Restricted vs. Unrestricted)</h3>
      <p>Churches hold fiduciary obligations to direct donor offerings to their intended purposes. The system segregates resources into distinct funds:</p>
      <ul>
        <li><strong>GEN — General Fund (Unrestricted):</strong> Operational tithes, regular offerings, utilities, administration, and pastoral support.</li>
        <li><strong>BLD — Building & Capital Fund (Restricted):</strong> Dedicated exclusively to church land acquisition, auditorium construction, and equipment financing.</li>
        <li><strong>MIS — Missions & Outreach Fund (Restricted):</strong> Rural church planting, missionary stipends, and evangelism campaigns.</li>
        <li><strong>WEL — Welfare & Benevolence Fund (Restricted):</strong> Member hardship relief, bereavement assistance, and medical support.</li>
        <li><strong>YTH — Youth Ministry Fund (Restricted):</strong> Youth camps, conferences, and Sunday school educational materials.</li>
      </ul>
      <p><em>Internal Control Rule:</em> Restricted funds are tracked with a lock icon. Any expenditure causing a restricted fund balance to drop below zero triggers an immediate Treasurer override alert.</p>

      <h3>1.5 Dual-Currency Architecture (GHS & USD)</h3>
      <p>The system operates in Ghana Cedis (GHS) as its primary functional currency, with full native US Dollar (USD) accounting for foreign missionary remittances, dollar bank accounts, and diaspora contributions. Rates are tracked with entry dates and names. Month-end foreign exchange gains or losses are calculated automatically under IAS 21.</p>

      <h3>1.6 Offline-First Resilience & Sync</h3>
      <p>The software operates completely offline without an active internet connection. Transactions are stored in an encrypted local database (IndexedDB). When connectivity is restored, changes sync in the background using conflict-free timestamping and row versioning.</p>
    `,
  },
  {
    id: 'roles',
    number: '2',
    title: 'User Roles, Permissions & Segregation of Duties',
    contentHtml: `
      <h3>2.1 Segregation of Duties Matrix</h3>
      <p>Financial integrity requires that no single individual controls the initiation, approval, recording, and disbursement of church funds. The platform enforces 7 distinct operational roles:</p>

      <table style="width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10pt;">
        <thead>
          <tr style="background-color: #1e4620; color: #ffffff;">
            <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">Role</th>
            <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">Primary Responsibilities</th>
            <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">Permissions & Restrictions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">Church Treasurer</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">Chief financial officer, general ledger posting, month-end closes, bank reconciliations, Trial Balance Doctor.</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">Full financial access. Can approve requisitions, perform USD revaluations, and revise budget allocations.</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">Finance Secretary</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">Daily accounting operations, recording member contributions, drafting payment vouchers, managing counting sheets.</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">Can create entries and vouchers; cannot close financial periods or perform single-handed approvals.</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">Offering Counter</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">Service-day collection counting, cash denomination tabulation, initial sheet sign-off.</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">Strictly limited to the Counting Sheet module. Cannot view individual member pledge totals or general ledger balances.</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">Senior Pastor / Elder</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">Executive governance, spiritual oversight, expenditure requisition approval, financial statements review.</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">Approval authorization up to constitutional threshold. View-only access to general ledger. Cannot initiate vouchers for themselves.</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">Internal Auditor</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">Independent compliance auditing, audit trail verification, trial balance checking.</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">Read-only across all financial ledgers and audit logs. Strictly prohibited from creating or modifying any transaction.</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">Department Head</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">Music, Youth, Children, or Missions ministry leaders managing annual budget lines.</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">Can submit expenditure requisitions and view their own department's budget utilization. Cannot access other departments.</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">System Administrator</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">User onboarding, password resets, role assignment, device authorizations, local backups.</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">System controls only. Has no access to view or edit financial ledger numbers.</td>
          </tr>
        </tbody>
      </table>
    `,
  },
  {
    id: 'dashboard',
    number: '3',
    title: 'Daily Navigation & Dashboard Interface',
    contentHtml: `
      <h3>3.1 Slim Page Header & Navigation Layout</h3>
      <p>The screen is laid out with an edge-to-edge flush sidebar (248px), a slim top bar, and a fluid main content area (capped at 1,800px on ultra-wide screens to maintain readable line length). On screens below 768px (mobile devices), the sidebar collapses to a persistent 5-button bottom navigation bar (Home, Giving, Expenses, Reports, More).</p>

      <h3>3.2 Period Selector & Live Dual-Currency Toggle</h3>
      <p>At the top of the dashboard, users can filter the financial window by:</p>
      <ul>
        <li><strong>This Month:</strong> Current calendar month (e.g., October 2026).</li>
        <li><strong>Last Month:</strong> Previous month comparative.</li>
        <li><strong>This Year:</strong> Full fiscal year-to-date.</li>
        <li><strong>Custom Range:</strong> Specific audit date boundaries.</li>
      </ul>
      <p>A <strong>GHS | USD toggle button</strong> converts every figure on the screen in real-time, displaying the effective exchange rate (e.g. <em>USD 1.00 = GHS 15.50</em>) and last update date.</p>

      <h3>3.3 Four-Column Statement Strip</h3>
      <p>The core health of the church is summarized in a clean horizontal strip partitioned with thin rules:</p>
      <ol>
        <li><strong>Total Giving & Income:</strong> Cumulative receipts from tithes, offerings, pledges, and interest.</li>
        <li><strong>Total Expenditure:</strong> Total operational, capital, and payroll disbursements.</li>
        <li><strong>Net Surplus / (Deficit):</strong> Operating margin for the period.</li>
        <li><strong>Cash & Bank Balances:</strong> Combined liquid reserves across physical cash floats and commercial bank accounts.</li>
      </ol>

      <h3>3.4 "Needs Attention" Actionable Alerts</h3>
      <p>When pending tasks require intervention, an attention alert banner appears with clear action buttons:</p>
      <ul>
        <li><em>"2 requisitions waiting for approval"</em> &rarr; [Review Approvals]</li>
        <li><em>"Sunday counting sheet needs second signature"</em> &rarr; [Sign Sheet]</li>
        <li><em>"USD exchange rate is 9 days old"</em> &rarr; [Update Rate]</li>
      </ul>

      <h3>3.5 Today Side-Panel</h3>
      <p>On screens 1,500px and wider, an executive panel is anchored on the right (collapsible into a slide-over drawer on smaller screens):</p>
      <ul>
        <li><strong>Month Status:</strong> Indicates whether the current month is Open or Closed, with countdown to the closing deadline.</li>
        <li><strong>Exchange Rate Entry:</strong> Daily rate, timestamp, and updater identity.</li>
        <li><strong>Trial Balance Doctor:</strong> One-line health status (e.g., <em>"Balanced. Checked 2 min ago"</em> or <em>"Alert: Difference of GHS 150.00"</em>).</li>
        <li><strong>Pending Approvals:</strong> Fast-action cards for the Pastor or Elder to approve or reject requisitions.</li>
        <li><strong>Sync Status:</strong> Live online/offline state and pending queue count.</li>
      </ul>
    `,
  },
  {
    id: 'counting',
    number: '4',
    title: 'Service-Day Collections & Counting Sheets',
    contentHtml: `
      <h3>4.1 The Dual-Control Counting Protocol</h3>
      <p>To eliminate opportunities for misappropriation, the counting room operates under strict dual-custody rules:</p>
      <ul>
        <li>All collection bags from ushers are brought into the counting room immediately after offering collection.</li>
        <li>Counting must be conducted by at least two authorized persons who are not related by family.</li>
        <li>Both counters must independently verify cash counts and sign the physical and digital counting sheet.</li>
      </ul>

      <h3>4.2 Denomination-by-Denomination Cash Breakdown</h3>
      <p>The counting interface features an intuitive matrix for entering individual note and coin counts:</p>
      <ul>
        <li><strong>Ghana Cedi Banknotes:</strong> GHS 200, GHS 100, GHS 50, GHS 20, GHS 10, GHS 5, GHS 2, GHS 1.</li>
        <li><strong>Ghana Cedi Coins:</strong> GHS 2.00, GHS 1.00, 50p, 20p, 10p.</li>
        <li><strong>US Dollar Currency:</strong> $100, $50, $20, $10, $5, $1 banknotes.</li>
      </ul>
      <p>As numbers are typed, the system computes the exact line total and grand total automatically without any manual math.</p>

      <h3>4.3 Cheques and Mobile Money (MoMo) Tracking</h3>
      <p>Non-cash collections are logged with complete audit details:</p>
      <ul>
        <li><strong>Cheques:</strong> Bank name, cheque number, drawer name, and amount.</li>
        <li><strong>Mobile Money:</strong> Telco network (MTN MoMo, Telecel Cash, AT Money), sender phone number, and 10-digit transaction ID.</li>
      </ul>

      <h3>4.4 Multi-Fund Allocation & Automatic Ledger Posting</h3>
      <p>Total collections are categorized by fund purpose (e.g., General Offering 60%, Building Project 30%, Welfare 10%). Once both Counter 1 and Counter 2 affix their digital sign-off:</p>
      <div style="background-color: #f1f5f9; padding: 10px; border-radius: 4px; font-size: 10pt;">
        <strong>Automated Balanced Journal Entry:</strong><br/>
        Dr [1010] Cash in Hand / Physical Safe &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (Total Cash)<br/>
        Dr [1030] Mobile Money Holding Account &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (Total MoMo)<br/>
        Cr [4010] Tithes & Offerings — General Fund &nbsp;&nbsp;&nbsp;&nbsp; (Allocated Portion)<br/>
        Cr [4020] Building Fund Contributions &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (Allocated Portion)
      </div>
    `,
  },
  {
    id: 'giving',
    number: '5',
    title: 'Giving Directory, Member Privacy & Receipts',
    contentHtml: `
      <h3>5.1 Member Registry & Envelope Tracking</h3>
      <p>The Giving Directory manages member profiles, unique church IDs (e.g., <code>MEM-042</code>), envelope numbers (e.g., <code>ENV-108</code>), family units, and ministry departments. Phone numbers are automatically masked (e.g., <em>•••• ••• 842</em>) to preserve donor privacy.</p>

      <h3>5.2 Privacy Masking Rules</h3>
      <p>To uphold biblical giving discretion:</p>
      <ul>
        <li><strong>Counter & Staff View:</strong> Member names are replaced with anonymous identifiers (e.g. <em>Member #MEM-014</em>) during routine counting and non-privileged reporting.</li>
        <li><strong>Privileged Pastoral View:</strong> Only the Senior Pastor and Head Treasurer possess authorization to toggle unmasked donor identity when counseling or certifying contribution records.</li>
      </ul>

      <h3>5.3 Official Printable Giving Receipts</h3>
      <p>When an individual donation is recorded, the system immediately issues a formal serialized church receipt featuring:</p>
      <ul>
        <li>Official church letterhead with the registered charity number and tax identification (TIN).</li>
        <li>Receipt number (e.g., <code>REC-2026-0041</code>) and date of receipt.</li>
        <li>Donor name (or anonymous designation) and envelope number.</li>
        <li>Amount in figures and complete words (e.g., <em>Two Thousand, Five Hundred Ghana Cedis Only</em>).</li>
        <li>Fund allocation, payment method, and signature of the issuing financial officer.</li>
      </ul>

      <h3>5.4 Annual Member Contribution Statements</h3>
      <p>At year-end or on member demand, the system generates a comprehensive annual contribution statement itemizing all tithes, building offerings, and special gifts, complete with a signed pastoral certification for official tax-deductible purposes.</p>

      <h3>5.5 Capital Campaign Pledges</h3>
      <p>For major capital projects (e.g., Sanctuary Roofing or Bus Purchase), the system tracks pledges, installments paid, outstanding balances, and completion percentages with clean progress indicators.</p>
    `,
  },
  {
    id: 'expenses',
    number: '6',
    title: 'Expenditure Management, Vouchers & Ghana WHT',
    contentHtml: `
      <h3>6.1 Three-Stage Procurement Internal Control</h3>
      <p>To prevent unauthorized spending, the system implements a strict 3-stage disbursement pipeline:</p>
      <ol>
        <li><strong>Stage 1: Requisition Submission:</strong> A Department Head submits an expenditure request stating purpose, fund, budget line, and estimated cost.</li>
        <li><strong>Stage 2: Pastoral / Elder Approval:</strong> The Senior Pastor or designated Elder reviews the requisition against departmental budget availability. If satisfied, they approve the request with an audit timestamp.</li>
        <li><strong>Stage 3: Payment Voucher Preparation:</strong> The Finance Secretary generates an official payment voucher from the approved requisition, specifying vendor details and withholding tax.</li>
      </ol>

      <h3>6.2 Ghana Withholding Tax (WHT) Compliance</h3>
      <p>Under Ghana Revenue Authority (GRA) tax laws (Income Tax Act 896), payments to commercial suppliers and service providers are subject to statutory withholding tax:</p>
      <ul>
        <li><strong>Supply of Goods:</strong> 3% statutory deduction.</li>
        <li><strong>Works & Construction:</strong> 5% statutory deduction.</li>
        <li><strong>Professional / Technical Services:</strong> 7.5% statutory deduction.</li>
      </ul>
      <p>The system calculates the WHT deduction automatically, creates a net payment voucher to the vendor, and credits the GRA Withholding Tax Payable liability account (<code>acct-2030</code>) for monthly remittance.</p>

      <h3>6.3 Triple Signature Payment Vouchers</h3>
      <p>Every voucher generated features a formal printable layout with:</p>
      <ul>
        <li>"Prepared By" signature (Finance Secretary).</li>
        <li>"Approved By" signature (Treasurer / Senior Pastor).</li>
        <li>"Received By" signature (Payee acknowledgment).</li>
        <li>Official church circular stamp verification box.</li>
      </ul>

      <h3>6.4 Petty Cash Imprest Float Management</h3>
      <p>For minor day-to-day church running costs (cleaning supplies, minor fuel, hospitality), the platform manages a fixed petty cash imprest float (e.g. GHS 1,500.00). When cash is disbursed, receipts are logged. A one-click replenishment generates a reimbursement cheque that returns the box to its exact target balance.</p>

      <h3>6.5 Fixed Asset Register</h3>
      <p>Tracks physical church property (musical instruments, sound consoles, pews, buses, air conditioners) with asset tags, serial numbers, locations, historical costs, and monthly straight-line depreciation schedules.</p>
    `,
  },
  {
    id: 'ledger',
    number: '7',
    title: 'Books of Account, General Ledger & Trial Balance Doctor',
    contentHtml: `
      <h3>7.1 Standard Church Chart of Accounts</h3>
      <p>The general ledger is organized under a standard 4-digit code structure:</p>
      <ul>
        <li><strong>1000–1999 Assets:</strong> Cash in vault (1010), Petty cash float (1020), MoMo clearing (1030), Commercial bank accounts (1040), USD domiciliary accounts (1050), Fixed assets (1500).</li>
        <li><strong>2000–2999 Liabilities:</strong> Accounts payable (2010), GRA PAYE payable (2020), GRA WHT payable (2030), SSNIT Tier 1 & 2 payable (2040).</li>
        <li><strong>3000–3999 Fund Balances / Equity:</strong> General fund capital (3010), Building restricted fund (3020), Missions fund (3030), Welfare fund (3040), Youth fund (3050).</li>
        <li><strong>4000–4999 Revenues & Incomes:</strong> Tithes (4010), Sunday offerings (4020), Thanksgiving (4030), Pledges (4040), Interest (4050).</li>
        <li><strong>5000–5999 Expenses:</strong> Pastoral & staff salaries (5010), Utilities & water (5020), Sanctuary maintenance (5030), Missions & evangelism (5040), Welfare disbursements (5050), Depreciation (5090).</li>
      </ul>

      <h3>7.2 Multi-Line Journal Entry Interface</h3>
      <p>Authorized finance officers can record compound journal entries with a dynamic live debit/credit indicator. If a 1-pesewa rounding difference occurs due to currency division, the system provides a one-click <strong>Auto-Balance 1p Rounding</strong> utility.</p>

      <h3>7.3 Trial Balance Doctor (Automated Self-Healing Diagnostics)</h3>
      <p>When books do not balance, the built-in <strong>Trial Balance Doctor</strong> executes 10 algorithmic diagnostics:</p>
      <ol>
        <li><strong>Debit/Credit Inequality:</strong> Checks exact mathematical parity.</li>
        <li><strong>Single-Legged Entry Detection:</strong> Scans for missing debit or credit sub-lines.</li>
        <li><strong>Transposition Error Detection:</strong> Tests if the difference is divisible by 9 (identifying flipped digits such as entering 54 instead of 45).</li>
        <li><strong>Inverted Polarity:</strong> Scans for entries posted to the wrong side of an account.</li>
        <li><strong>Foreign Currency Translation:</strong> Verifies historical exchange rates on USD entries.</li>
        <li><strong>Orphan Fund Allocation:</strong> Identifies lines referencing non-existent funds.</li>
        <li><strong>Overdrawn Restricted Funds:</strong> Detects unauthorized deficits in building or missions funds.</li>
        <li><strong>Closed Period Tampering:</strong> Flags any transaction backdated into locked months.</li>
        <li><strong>Rounding Accumulation:</strong> Detects fractional pesewa variances.</li>
        <li><strong>Pending Sync Discrepancies:</strong> Highlights offline entries awaiting cloud merge.</li>
      </ol>
      <p>Each defect is ranked by confidence with an actionable self-healing button.</p>

      <h3>7.4 Month-End USD Revaluations (IAS 21)</h3>
      <p>At the end of each calendar month, the Treasurer enters the closing Bank of Ghana exchange rate. The system computes unrealized foreign exchange gains or losses on USD holdings and posts the required adjusting entry to account <code>5980 (FX Gain/Loss)</code>.</p>
    `,
  },
  {
    id: 'payroll',
    number: '8',
    title: 'Church Staff & Payroll Management',
    contentHtml: `
      <h3>8.1 Staff Registry & Compensation</h3>
      <p>The Payroll module maintains records for pastoral clergy, administrative secretaries, caretakers, and musicians. Basic salary, housing allowances, transport allowances, and pastoral responsibility stipends are configured per staff member.</p>

      <h3>8.2 Ghana SSNIT Tier 1 Pension Compliance</h3>
      <p>The platform computes statutory pension contributions under Ghana National Pensions Act (Act 766):</p>
      <ul>
        <li><strong>Employee Tier 1 Deduction:</strong> 5.5% deducted from basic salary.</li>
        <li><strong>Employer (Church) Contribution:</strong> 13.0% contributed by the church.</li>
        <li><strong>Total SSNIT Remittance:</strong> 18.5% credited to SSNIT Payable (<code>acct-2040</code>).</li>
      </ul>

      <h3>8.3 Ghana Revenue Authority (GRA) Graduated PAYE Tax</h3>
      <p>Income tax is calculated automatically using current GRA graduated monthly tax brackets (applying personal relief thresholds, progressive percentages up to 35%, and statutory exemptions for pastoral housing).</p>

      <h3>8.4 Automated Balanced Payroll Ledger Posting</h3>
      <p>Executing a monthly payroll run creates a compound, balanced journal entry:</p>
      <div style="background-color: #f1f5f9; padding: 10px; border-radius: 4px; font-size: 10pt;">
        Dr [5010] Pastoral & Staff Salaries &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (Gross Salaries)<br/>
        Dr [5015] Employer SSNIT Pension Expense &nbsp;&nbsp;&nbsp;&nbsp; (13% Church Share)<br/>
        Cr [2020] GRA PAYE Tax Withheld Payable &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (Income Tax)<br/>
        Cr [2040] SSNIT Contributions Payable &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (18.5% Total Pension)<br/>
        Cr [1040] Church Commercial Bank Account &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (Net Disbursed)
      </div>

      <h3>8.5 Printable Individual Payslips</h3>
      <p>Generates printable monthly payslips for every staff member featuring church letterhead, earnings breakdown, statutory deductions, net payable amount in figures and words, and employee acknowledgment receipt lines.</p>
    `,
  },
  {
    id: 'reports',
    number: '9',
    title: 'Financial Statements, Audits & Council Exports',
    contentHtml: `
      <h3>9.1 The 11 Standard Church Financial Statements</h3>
      <p>The Reports module provides real-time generation of 11 official accounting reports:</p>
      <ol>
        <li><strong>Statement of Income & Expenditure:</strong> Operating surplus or deficit across all funds.</li>
        <li><strong>Statement of Financial Position (Balance Sheet):</strong> Current assets, liabilities, and fund capital balances.</li>
        <li><strong>Statement of Cash Flows:</strong> Operating, investing, and financing cash activities.</li>
        <li><strong>Fund Balance Summary:</strong> Opening balance, receipts, expenditures, and closing net assets per fund.</li>
        <li><strong>Budget vs. Actual Variance Report:</strong> Percentage utilization and favorable/unfavorable variance.</li>
        <li><strong>Departmental Expenditure Breakdown:</strong> Ministry-by-ministry spending analysis.</li>
        <li><strong>Vendor & Procurement Summary:</strong> Cumulative payments and WHT withheld per contractor.</li>
        <li><strong>Annual Member Contribution Digest:</strong> Statistical summary of giving patterns.</li>
        <li><strong>Capital Campaign Pledge Fulfillment:</strong> Campaign targets, receipts, and outstanding pledges.</li>
        <li><strong>GRA Withholding Tax (WHT) Schedule:</strong> Official tax schedule ready for GRA filing.</li>
        <li><strong>Trial Balance Audit Report:</strong> Comprehensive line-by-line debit/credit audit schedule.</li>
      </ol>

      <h3>9.2 Exporting to Microsoft Word (.doc) for Council Minutes</h3>
      <p>Any statement can be downloaded as an official Microsoft Word document (.doc). The generated document includes church letterhead, formatted tables, headers, and signature lines, allowing Church Council secretaries to paste reports directly into Council meeting minutes.</p>

      <h3>9.3 PDF Export with A4 Pagination & Watermarks</h3>
      <p>PDF exports automatically paginate cleanly for A4 printing with running headers, "Page X of Y" page numbering, and dynamic watermarks (<em>"DEMO — NOT OFFICIAL"</em> or <em>"DRAFT"</em> when unclosed).</p>
    `,
  },
  {
    id: 'demo',
    number: '10',
    title: 'Training Demo Mode & Sandbox Environment',
    contentHtml: `
      <h3>10.1 Safe Training Sandbox</h3>
      <p>To train newly elected finance committees, counters, and auditors without endangering church financial books, the system includes a complete <strong>Training Demo Mode</strong>.</p>

      <h3>10.2 Complete Database Isolation</h3>
      <p>The demo environment runs on isolated databases (<code>church_demo_*</code>) separate from live operational data (<code>church_live_*</code>). Changes made in demo mode never affect live church accounts.</p>

      <h3>10.3 Realistic Ghanaian Church Dataset</h3>
      <p>Demo mode comes preloaded with a realistic 300-member Ghanaian church congregation (Accra Central Grace Chapel) complete with:</p>
      <ul>
        <li>Realistic Ghanaian names (Mensah, Darko, Addo, Boateng, Ofori).</li>
        <li>Active Sunday counting sheets (cash, cheques, MoMo).</li>
        <li>Sample payment vouchers with GRA WHT deductions.</li>
        <li>Staff payroll records with SSNIT and PAYE.</li>
        <li>Open items (requisitions awaiting approval, unposted counting sheets).</li>
      </ul>

      <h3>10.4 Hard Guard Against Accidental Sync</h3>
      <p>When Demo Mode is active, background cloud synchronization is physically blocked by an algorithmic guard. An amber banner and print watermarks (<em>"DEMO — NOT OFFICIAL"</em>) ensure demo documents are never mistaken for official records.</p>
    `,
  },
  {
    id: 'offline',
    number: '11',
    title: 'Offline Synchronization, Security & Disaster Recovery',
    contentHtml: `
      <h3>11.1 Offline-First IndexedDB Engine</h3>
      <p>The system stores all ledger entries, member records, and vouchers locally in browser IndexedDB. Transactions can be entered without internet access during power outages or remote missions.</p>

      <h3>11.2 Background Synchronization & Concurrency Control</h3>
      <p>When an internet connection is established, the platform syncs with the remote server. Optimistic concurrency control uses <code>row_version</code> counters to detect collisions if two devices edit the same record offline.</p>

      <h3>11.3 Concurrency Conflict Resolution Modal</h3>
      <p>If a collision occurs, a side-by-side comparison modal presents the local offline version against the server version, allowing the Treasurer to select which revision takes precedence.</p>

      <h3>11.4 Non-Blocking Rejection Quarantine</h3>
      <p>If an offline entry violates server constraints (such as posting to a locked month), it is placed in an isolated "Needs Attention" quarantine without blocking subsequent transactions. Authorized officers can inspect the trace, modify the line, and re-queue.</p>

      <h3>11.5 Encrypted Backups & Disaster Recovery</h3>
      <p>Treasurers should perform weekly local encrypted database backups via <strong>Settings &rarr; Export Encrypted Backup</strong>. The exported JSON/DB file can be restored onto any authorized computer in the event of hardware theft or failure.</p>
    `,
  },
];
