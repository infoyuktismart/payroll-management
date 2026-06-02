import jsPDF from 'jspdf'

export const generateForm12BB = ({ employee, company, taxForm, financialYear }) => {
    const doc = new jsPDF()
    const primaryColor = [15, 23, 42]
    const accentColor = [37, 99, 235]

    // Title / Header
    doc.setFillColor(...primaryColor)
    doc.rect(0, 0, 210, 40, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('FORM NO. 12BB', 14, 20)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('[See rule 26C]', 14, 26)
    doc.setFont('helvetica', 'italic')
    doc.text('Statement of claims by an employee for claiming deduction under section 192', 14, 32)

    // Financial Year Box
    doc.setFillColor(...accentColor)
    doc.rect(160, 12, 36, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Financial Year', 163, 18)
    doc.setFontSize(11)
    doc.text(financialYear || '2026-27', 163, 25)

    // Sections
    let y = 52
    doc.setTextColor(...primaryColor)

    const drawSectionHeader = (title) => {
        doc.setFillColor(241, 245, 249)
        doc.rect(14, y - 4, 182, 7, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(...primaryColor)
        doc.text(title, 16, y + 1)
        y += 8
    }

    const drawRow = (label, value) => {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(71, 85, 105)
        doc.text(label, 16, y)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text(String(value), 140, y)
        
        doc.setDrawColor(241, 245, 249)
        doc.line(14, y + 2, 196, y + 2)
        y += 8
    }

    // 1. Details of the Employee
    drawSectionHeader('1. Details of the Employee')
    drawRow('Name of the Employee:', `${employee.first_name || ''} ${employee.last_name || ''}`)
    drawRow('Designation:', employee.designation || 'N/A')
    drawRow('Permanent Account Number (PAN):', employee.pan_number || 'N/A')
    drawRow('Aadhaar Number:', employee.aadhaar_number || 'N/A')
    y += 4

    // 2. Details of the Employer
    drawSectionHeader('2. Details of the Employer')
    drawRow('Name of the Employer:', company.company_name || company.name || 'YUKTI SMART AUTOMATION')
    drawRow('Employer PAN:', company.pan_number || 'N/A')
    drawRow('Address:', company.address || 'N/A')
    y += 4

    // 3. Claims for Deductions & Exemptions
    drawSectionHeader('3. Claims for Deductions, Exemptions & Other Income')
    drawRow('House Rent Allowance (HRA Exemption):', `INR ${Number(taxForm.hra_exemption || 0).toLocaleString('en-IN')}`)
    drawRow('Section 80C Deductions:', `INR ${Number(taxForm.section_80c || 0).toLocaleString('en-IN')}`)
    drawRow('Section 80D Deductions (Medical):', `INR ${Number(taxForm.section_80d || 0).toLocaleString('en-IN')}`)
    drawRow('Interest on Home Loan (Section 24):', `INR ${Number(taxForm.home_loan_interest || 0).toLocaleString('en-IN')}`)
    drawRow('Other Deductions:', `INR ${Number(taxForm.other_deductions || 0).toLocaleString('en-IN')}`)
    drawRow('Income from Other Sources:', `INR ${Number(taxForm.other_income || 0).toLocaleString('en-IN')}`)
    drawRow('TDS Already Deducted YTD:', `INR ${Number(taxForm.tds_already_deducted || 0).toLocaleString('en-IN')}`)
    y += 8

    // Verification declaration
    doc.setFillColor(248, 250, 252)
    doc.rect(14, y, 182, 28, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.rect(14, y, 182, 28, 'D')
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(15, 23, 42)
    doc.text('Verification', 18, y + 5)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(71, 85, 105)
    const verificationText = `I, ${employee.first_name || ''} ${employee.last_name || ''}, do hereby declare that what is stated above is true and correct to the best of my knowledge and belief.`
    doc.text(doc.splitTextToSize(verificationText, 174), 18, y + 10)
    
    y += 48
    
    // Signatures
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text('Place: ________________________', 16, y)
    doc.text('Date:  ________________________', 16, y + 8)
    
    doc.text('Signature of the Employee: ________________________', 110, y)

    // Save PDF
    const nameStr = `${employee.first_name || ''}_${employee.last_name || ''}`.replace(/\s+/g, '_')
    doc.save(`Form12BB_${nameStr}_FY_${financialYear}.pdf`)
}
