import { downloadBlob } from './payrollUtils'

const escapeXml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

const formatTallyDate = (dateValue) => {
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return ''
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}${mm}${dd}`
}

const getEmployeeName = (item) => item.name || `${item.employee?.first_name || ''} ${item.employee?.last_name || ''}`.trim() || item.empId || 'Employee'

const buildLedgerEntries = (items, options = {}) => {
    const salaryLedger = options.salaryLedger || 'Salary Payable'
    const bankLedger = options.bankLedger || 'Bank Account'
    const expenseLedger = options.expenseLedger || 'Salary Expense'
    const totalNet = (items || []).reduce((sum, item) => sum + (Number(item.netSalary ?? item.net_salary) || 0), 0)

    return [
        {
            ledgerName: expenseLedger,
            amount: totalNet,
            isDeemedPositive: 'No',
            narration: `Salary expense for ${options.periodLabel || options.period || ''}`.trim()
        },
        {
            ledgerName: salaryLedger,
            amount: -totalNet,
            isDeemedPositive: 'Yes',
            narration: `Salary payable for ${options.periodLabel || options.period || ''}`.trim()
        },
        ...(options.includeBankClearing ? [{
            ledgerName: salaryLedger,
            amount: totalNet,
            isDeemedPositive: 'No',
            narration: 'Salary payable cleared'
        }, {
            ledgerName: bankLedger,
            amount: -totalNet,
            isDeemedPositive: 'Yes',
            narration: 'Salary bank transfer'
        }] : [])
    ]
}

export const buildTallyJournalVoucherXML = (items = [], options = {}) => {
    const voucherDate = formatTallyDate(options.voucherDate || new Date())
    const period = options.periodLabel || options.period || ''
    const voucherNumber = options.voucherNumber || `PAY-${String(period || voucherDate).replace(/[^a-z0-9]/gi, '')}`
    const ledgerEntries = buildLedgerEntries(items, options)
    const employeeLines = items.map(item => `${getEmployeeName(item)}: ${Number(item.netSalary ?? item.net_salary) || 0}`).join('; ')

    return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(options.companyName || '')}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${voucherDate}</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(voucherNumber)}</VOUCHERNUMBER>
            <REFERENCE>${escapeXml(voucherNumber)}</REFERENCE>
            <NARRATION>${escapeXml(options.narration || `Payroll journal for ${period}. ${employeeLines}`)}</NARRATION>
            ${ledgerEntries.map(entry => `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(entry.ledgerName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${entry.isDeemedPositive}</ISDEEMEDPOSITIVE>
              <AMOUNT>${Number(entry.amount || 0).toFixed(2)}</AMOUNT>
              <BILLALLOCATIONS.LIST>
                <NAME>${escapeXml(voucherNumber)}</NAME>
                <BILLTYPE>New Ref</BILLTYPE>
                <AMOUNT>${Number(entry.amount || 0).toFixed(2)}</AMOUNT>
              </BILLALLOCATIONS.LIST>
            </ALLLEDGERENTRIES.LIST>`).join('')}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`
}

export const buildTallyJournalVoucherCSV = (items = [], options = {}) => {
    const period = options.periodLabel || options.period || ''
    const voucherNumber = options.voucherNumber || `PAY-${String(period || new Date().toISOString().slice(0, 10)).replace(/[^a-z0-9]/gi, '')}`
    const headers = ['Voucher Date', 'Voucher Type', 'Voucher Number', 'Ledger', 'Debit', 'Credit', 'Narration', 'Employee Count']
    const rows = buildLedgerEntries(items, options).map(entry => [
        options.voucherDate || new Date().toISOString().slice(0, 10),
        'Journal',
        voucherNumber,
        entry.ledgerName,
        entry.amount > 0 ? entry.amount.toFixed(2) : '',
        entry.amount < 0 ? Math.abs(entry.amount).toFixed(2) : '',
        entry.narration,
        items.length
    ])

    return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n')
}

export const downloadTallyJournalXML = (items, options = {}) => {
    const period = String(options.period || new Date().toISOString().slice(0, 7)).replace(/[^a-z0-9]/gi, '_')
    downloadBlob(buildTallyJournalVoucherXML(items, options), `tally_payroll_journal_${period}.xml`, 'application/xml;charset=utf-8;')
}

export const downloadTallyJournalCSV = (items, options = {}) => {
    const period = String(options.period || new Date().toISOString().slice(0, 7)).replace(/[^a-z0-9]/gi, '_')
    downloadBlob(buildTallyJournalVoucherCSV(items, options), `tally_payroll_journal_${period}.csv`)
}
