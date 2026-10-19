import React, { useState } from 'react'
import { CheckCircle, X, FileText, Download, Loader2 } from 'lucide-react'
import { devLog } from '../../lib/devLogger'
import { useToast } from '../../context/ToastContext'

export function ConfirmFinalizeModal({
    isOpen,
    onClose,
    onConfirm,
    employeeCount
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center space-x-3 text-emerald-600 mb-4">
                    <CheckCircle className="w-8 h-8" />
                    <h3 className="text-xl font-bold">Confirm Finalization</h3>
                </div>
                <p className="text-gray-600 mb-8 font-medium">
                    Are you sure you want to finalize payroll for <span className="text-slate-900 font-extrabold">{employeeCount} employees</span>?
                    <br /><br />
                    This will save permanent records to the database and update historical data. This action cannot be undone.
                </p>
                <div className="flex space-x-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all"
                    >
                        Yes, Finalize
                    </button>
                </div>
            </div>
        </div>
    )
}

export function PayslipPreviewModal({
    isOpen,
    onClose,
    item,
    month,
    formatCurrency
}) {
    const toast = useToast()
    const [downloading, setDownloading] = useState(false)

    if (!isOpen || !item) return null

    const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    const handleDownload = async () => {
        setDownloading(true)
        const element = document.getElementById('payslip-content')
        try {
            const [{ default: jsPDFLib }, { default: html2canvasLib }] = await Promise.all([
                import('jspdf'),
                import('html2canvas')
            ])
            
            const canvas = await html2canvasLib(element, {
                scale: 1.5,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    const clonedRoot = clonedDoc.getElementById('payslip-content');
                    if (clonedRoot) {
                        const styles = clonedDoc.getElementsByTagName('style');
                        const links = clonedDoc.getElementsByTagName('link');
                        while (styles.length > 0) styles[0].parentNode.removeChild(styles[0]);
                        while (links.length > 0) links[0].parentNode.removeChild(links[0]);

                        const stripClasses = (el) => {
                            el.removeAttribute('class');
                            [...el.children].forEach(stripClasses);
                        };
                        stripClasses(clonedRoot);

                        clonedRoot.style.width = '794px';
                        clonedRoot.style.maxWidth = 'none';
                        clonedRoot.style.minHeight = '1123px';
                        clonedRoot.style.margin = '0 auto';
                        clonedRoot.style.padding = '40px';
                        clonedRoot.style.backgroundColor = '#ffffff';
                        clonedRoot.style.position = 'static';
                        clonedRoot.style.overflow = 'visible';
                    }
                }
            })

            const imgData = canvas.toDataURL('image/jpeg', 0.95)
            devLog('Image captured to DataURL, length:', imgData.length)

            if (!imgData || imgData.length < 500) {
                console.error('Image capture seems too small or failed')
                throw new Error('Image capture failed - rendered content is empty')
            }

            const pdf = new jsPDFLib('p', 'mm', 'a4')
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
            const sanitizedName = item.name.replace(/[^a-z0-9]/gi, '_')
            const sanitizedID = (item.empId || 'ID').toString().replace(/[^a-z0-9]/gi, '_')
            const sanitizedMonth = monthName.replace(/[^a-z0-9]/gi, '_')
            const fileName = `${sanitizedName}_${sanitizedID}_${sanitizedMonth}.pdf`

            devLog('Generating PDF:', fileName)

            const pdfBlob = pdf.output('blob')

            const saveAs = (blob, name) => {
                if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                    window.navigator.msSaveOrOpenBlob(blob, name)
                    return
                }

                const url = window.URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.style.display = 'none'
                link.href = url
                link.setAttribute('download', name)

                document.body.appendChild(link)
                link.click()

                setTimeout(() => {
                    document.body.removeChild(link)
                    window.URL.revokeObjectURL(url)
                }, 2000)
            }

            saveAs(pdfBlob, fileName)
            devLog('Download triggered successfully via robust saveAs for:', fileName)
        } catch (error) {
            toast.error(`PDF generation failed: ${error.message || 'Unknown error'}. Please use the Print option instead.`)
        } finally {
            setDownloading(false)
        }
    }

    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 print-container-root print:p-0 print:bg-transparent print:backdrop-blur-none">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl relative animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[92vh] border border-slate-200 print:max-h-none print:w-full print:border-none print:shadow-none print:rounded-none print-reset">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-start print:hidden">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800">Payslip - {monthName}</h2>
                        <p className="text-sm text-gray-400 mt-1 font-medium">{item.name} ({item.empId})</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div id="payslip-content" style={{ flexGrow: 1, overflowY: 'auto', backgroundColor: '#ffffff', color: '#111827', width: '100%', padding: '2rem 2.5rem 4rem 2.5rem' }}>
                    {/* Company Branding */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: '900', fontStyle: 'italic', color: '#0f172a', margin: 0, letterSpacing: '-0.05em' }}>YUKTI <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', fontStyle: 'normal', letterSpacing: '0.2em', color: '#2563eb', marginTop: '4px' }}>SMART AUTOMATION</span></h1>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>PAYSLIP CONFIDENTIAL</p>
                            <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', margin: '4px 0 0 0' }}>{monthName}</p>
                        </div>
                    </div>

                    {/* Employee Profile Card */}
                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '1.5rem', padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Employee Name</p>
                            <p style={{ fontSize: '1.125rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>{item.name}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Employee ID</p>
                            <p style={{ fontSize: '1.125rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>{item.empId}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Designation</p>
                            <p style={{ fontWeight: '700', color: '#334155', margin: 0 }}>{item.designation}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Department</p>
                            <p style={{ fontWeight: '700', color: '#334155', margin: 0 }}>{item.employee?.department || 'Technology'}</p>
                        </div>
                    </div>

                    {/* Attendance Summary */}
                    <div style={{ marginBottom: '2.5rem' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: '900', color: '#0f172a', marginBottom: '1rem', letterSpacing: '-0.02em' }}>Attendance Summary</h3>
                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '1.5rem', padding: '1.5rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                            <div style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>{item.totalDays}</p>
                                <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px' }}>Total Days</p>
                            </div>
                            <div style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#059669', margin: 0 }}>{item.payableDays}</p>
                                <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px' }}>Payable</p>
                            </div>
                            <div style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#dc2626', margin: 0 }}>{item.totalDays - item.payableDays}</p>
                                <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px' }}>Loss of Pay</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#2563eb', margin: 0 }}>0</p>
                                <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px' }}>Leave</p>
                            </div>
                        </div>
                    </div>

                    {/* Earnings & Deductions Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginBottom: '2.5rem' }}>
                        {/* Earnings */}
                        <div>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: '900', color: '#059669', marginBottom: '1rem', borderBottom: '1px solid #ecfdf5', paddingBottom: '0.5rem' }}>Earnings</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {(item.earningsList && item.earningsList.length > 0) ? (
                                    item.earningsList.map((earn, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                            <span style={{ color: '#64748b', fontWeight: '500' }}>{earn.name}</span>
                                            <span style={{ color: '#1e293b', fontWeight: '700' }}>{formatCurrency(earn.amount)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                            <span style={{ color: '#64748b', fontWeight: '500' }}>Basic Salary</span>
                                            <span style={{ color: '#1e293b', fontWeight: '700' }}>{formatCurrency(item.basicSalary)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                            <span style={{ color: '#64748b', fontWeight: '500' }}>HRA</span>
                                            <span style={{ color: '#1e293b', fontWeight: '700' }}>{formatCurrency(item.basicSalary * 0.4)}</span>
                                        </div>
                                    </>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #f1f5f9', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
                                    <p style={{ color: '#0f172a', fontWeight: '900', fontSize: '0.875rem', margin: 0 }}>Gross Earnings</p>
                                    <p style={{ color: '#0f172a', fontWeight: '900', fontSize: '0.875rem', margin: 0 }}>{formatCurrency(item.grossSalary)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Deductions */}
                        <div>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: '900', color: '#dc2626', marginBottom: '1rem', borderBottom: '1px solid #fef2f2', paddingBottom: '0.5rem' }}>Deductions</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {item.deductionsList && item.deductionsList.map((ded, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                        <span style={{ color: '#64748b', fontWeight: '500' }}>{ded.name}</span>
                                        <span style={{ color: '#1e293b', fontWeight: '700' }}>{formatCurrency(ded.amount)}</span>
                                    </div>
                                ))}
                                {(!item.deductionsList || item.deductionsList.length === 0) && (
                                    <p style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#94a3b8', margin: 0, padding: '0.5rem 0' }}>No deductions applied</p>
                                )}
                                <div style={{ marginTop: 'auto', paddingTop: '2.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #f1f5f9', paddingTop: '0.75rem' }}>
                                        <p style={{ color: '#0f172a', fontWeight: '900', fontSize: '0.875rem', margin: 0 }}>Total Deductions</p>
                                        <p style={{ color: '#0f172a', fontWeight: '900', fontSize: '0.875rem', margin: 0 }}>{formatCurrency(item.totalDeductions)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Net Salary Highlight Box */}
                    <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '1.5rem', padding: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#166534', margin: 0 }}>Net Salary</h3>
                            <p style={{ fontSize: '10px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Amount Payable to Employee</p>
                        </div>
                        <p style={{ fontSize: '2.25rem', fontWeight: '900', color: '#15803d', margin: 0 }}>{formatCurrency(item.netSalary)}</p>
                    </div>

                    {/* Disclaimer Footer */}
                    <div style={{ marginTop: '4rem', textAlign: 'center', paddingBottom: '2rem' }}>
                        <p style={{ fontSize: '10px', fontWeight: '600', fontStyle: 'italic', color: '#94a3b8', margin: 0 }}>This is a computer generated document and does not require a physical signature.</p>
                        <p style={{ fontSize: '9px', fontWeight: '500', color: '#cbd5e1', marginTop: '0.5rem' }}>© {new Date().getFullYear()} Yukti Smart Automation. All rights reserved.</p>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-8 py-6 border-t border-gray-100 flex justify-end space-x-3 bg-white rounded-b-3xl print:hidden">
                    <button onClick={handlePrint} className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-gray-50 transition-all flex items-center space-x-2">
                        <FileText className="w-4 h-4" />
                        <span>Print</span>
                    </button>
                    <button onClick={onClose} className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-gray-50 transition-all">
                        Close
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex items-center space-x-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span>{downloading ? 'Generating...' : 'Download PDF'}</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
