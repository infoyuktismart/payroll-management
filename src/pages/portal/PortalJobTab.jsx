import { useState, useEffect } from 'react'
import { FileText, AlertCircle, MapPin, User, X, ChevronDown, ChevronRight, GitCommit, Plus, Edit2, Trash2, ShieldAlert } from 'lucide-react'
import { employeeService } from '../../services/employeeService'
import { supabase } from '../../lib/supabase'
import { withCompanyScope } from '../../services/tenantScope'

export default function PortalJobTab({
    currentEmployee,
    tenureText,
    formatDateSafe,
    toast
}) {
    const [showCareerPathModal, setShowCareerPathModal] = useState(false)
    const [employees, setEmployees] = useState([])
    const [loadingOrg, setLoadingOrg] = useState(true)
    const [showPeers, setShowPeers] = useState(true)
    const [showReports, setShowReports] = useState(true)

    // Nominee States
    const [nominees, setNominees] = useState([])
    const [loadingNominees, setLoadingNominees] = useState(true)
    const [isNomineeModalOpen, setIsNomineeModalOpen] = useState(false)
    const [editingNominee, setEditingNominee] = useState(null)
    const [nomineeForm, setNomineeForm] = useState({
        name: '',
        relationship: '',
        pf_share_percentage: '',
        date_of_birth: '',
        aadhaar_number: ''
    })
    const [nomineeFormErrors, setNomineeFormErrors] = useState({})
    const [savingNominee, setSavingNominee] = useState(false)

    // Delete Nominee Modal States
    const [showNomineeDeleteModal, setShowNomineeDeleteModal] = useState(false)
    const [nomineeToDelete, setNomineeToDelete] = useState(null)
    const [deletingNominee, setDeletingNominee] = useState(false)

    const fetchNominees = async () => {
        if (!currentEmployee?.id) return
        setLoadingNominees(true)
        try {
            const { data, error } = await supabase
                .from('employee_nominees')
                .select('*')
                .eq('employee_id', currentEmployee.id)
                .order('created_at', { ascending: true })

            if (error) throw error
            setNominees(data || [])
        } catch (err) {
            console.error("Failed to load nominees:", err)
        } finally {
            setLoadingNominees(false)
        }
    }

    useEffect(() => {
        const loadOrg = async () => {
            try {
                const list = await employeeService.getAllEmployees()
                setEmployees(list)
            } catch (err) {
                console.error("Failed to load org chart", err)
            } finally {
                setLoadingOrg(false)
            }
        }
        loadOrg()
        fetchNominees()
    }, [currentEmployee?.id])

    const getFullName = (emp) => `${emp.first_name || ''} ${emp.last_name || ''}`.trim()

    const selfName = getFullName(currentEmployee)
    const managerName = currentEmployee.reporting_person
    const managerObj = employees.find(emp => getFullName(emp).toLowerCase() === (managerName || '').toLowerCase())

    const peers = managerName
        ? employees.filter(emp => emp.id !== currentEmployee.id && (emp.reporting_person || '').toLowerCase() === managerName.toLowerCase())
        : []

    const reports = employees.filter(emp => (emp.reporting_person || '').toLowerCase() === selfName.toLowerCase())

    // Nominee CRUD Operations
    const totalShare = nominees.reduce((sum, n) => sum + parseFloat(n.pf_share_percentage || 0), 0)

    const openAddNomineeModal = () => {
        setEditingNominee(null)
        setNomineeForm({
            name: '',
            relationship: '',
            pf_share_percentage: '',
            date_of_birth: '',
            aadhaar_number: ''
        })
        setNomineeFormErrors({})
        setIsNomineeModalOpen(true)
    }

    const openEditNomineeModal = (nom) => {
        setEditingNominee(nom)
        setNomineeForm({
            name: nom.name || '',
            relationship: nom.relationship || '',
            pf_share_percentage: nom.pf_share_percentage?.toString() || '',
            date_of_birth: nom.date_of_birth || '',
            aadhaar_number: nom.aadhaar_number || ''
        })
        setNomineeFormErrors({})
        setIsNomineeModalOpen(true)
    }

    const handleNomineeInputChange = (e) => {
        const { name, value } = e.target
        setNomineeForm(prev => ({ ...prev, [name]: value }))
    }

    const handleSaveNominee = async (e) => {
        e.preventDefault()
        const errors = {}

        if (!nomineeForm.name.trim()) errors.name = 'Name is required'
        if (!nomineeForm.relationship.trim()) errors.relationship = 'Relationship is required'
        if (!nomineeForm.date_of_birth) errors.date_of_birth = 'Date of Birth is required'

        const sharePercentage = parseFloat(nomineeForm.pf_share_percentage)
        if (isNaN(sharePercentage) || sharePercentage <= 0 || sharePercentage > 100) {
            errors.pf_share_percentage = 'Share % must be between 0.01 and 100'
        } else {
            const activeNominees = nominees.filter(n => n.id !== editingNominee?.id)
            const activeShareSum = activeNominees.reduce((sum, n) => sum + parseFloat(n.pf_share_percentage || 0), 0)
            if (activeShareSum + sharePercentage > 100) {
                errors.pf_share_percentage = `Total share cannot exceed 100% (Maximum allowed for this nominee: ${(100 - activeShareSum).toFixed(2)}%)`
            }
        }

        if (nomineeForm.aadhaar_number && !/^\d{12}$/.test(nomineeForm.aadhaar_number.replace(/\s+/g, ''))) {
            errors.aadhaar_number = 'Aadhaar must be exactly 12 digits'
        }

        if (Object.keys(errors).length > 0) {
            setNomineeFormErrors(errors)
            return
        }

        setSavingNominee(true)
        try {
            const payload = withCompanyScope({
                employee_id: currentEmployee.id,
                name: nomineeForm.name.trim(),
                relationship: nomineeForm.relationship.trim(),
                pf_share_percentage: sharePercentage,
                date_of_birth: nomineeForm.date_of_birth,
                aadhaar_number: nomineeForm.aadhaar_number.replace(/\s+/g, '').trim() || null
            })

            if (editingNominee) {
                const { error } = await supabase
                    .from('employee_nominees')
                    .update(payload)
                    .eq('id', editingNominee.id)

                if (error) throw error
                toast.success('Nominee updated successfully.')
            } else {
                const { error } = await supabase
                    .from('employee_nominees')
                    .insert([payload])

                if (error) throw error
                toast.success('PF Nominee added successfully.')
            }

            setIsNomineeModalOpen(false)
            fetchNominees()
        } catch (err) {
            console.error("Nominee CRUD error:", err)
            toast.error("Failed to save nominee: " + err.message)
        } finally {
            setSavingNominee(false)
        }
    }

    const handleDeleteNomineeClick = (nom) => {
        setNomineeToDelete(nom)
        setShowNomineeDeleteModal(true)
    }

    const confirmDeleteNominee = async () => {
        if (!nomineeToDelete) return
        setDeletingNominee(true)
        try {
            const { error } = await supabase
                .from('employee_nominees')
                .delete()
                .eq('id', nomineeToDelete.id)

            if (error) throw error
            toast.success('Nominee removed successfully.')
            setShowNomineeDeleteModal(false)
            setNomineeToDelete(null)
            fetchNominees()
        } catch (err) {
            console.error("Nominee delete error:", err)
            toast.error("Failed to delete nominee: " + err.message)
        } finally {
            setDeletingNominee(false)
        }
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-250 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800">Job Information</h3>
                        <FileText className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Job Title</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{currentEmployee.designation || 'Employee'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Department</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{currentEmployee.department || 'General'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Business Unit</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{currentEmployee.department || 'Operations'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Reporting Manager</p>
                            <p className="text-sm font-bold text-slate-800 mt-1 inline-flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 inline-flex items-center justify-center">
                                    <User className="w-3.5 h-3.5 text-slate-500" />
                                </span>
                                {currentEmployee.reporting_person || 'Not Assigned'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-250 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800">Employment Details</h3>
                        <AlertCircle className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Employment Type</p>
                            <span className="inline-flex mt-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold capitalize">
                                {currentEmployee.employment_type || 'Permanent'}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Joining Date</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{formatDateSafe(currentEmployee.joining_date, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Work Location</p>
                            <p className="text-sm font-bold text-slate-800 mt-1 inline-flex items-center gap-1.5">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                {currentEmployee.department || 'Main Office'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Tenure</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{tenureText}</p>
                        </div>
                    </div>
                </div>

                {/* PF Nominees & Beneficiaries Registry */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-250 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800">Statutory PF Nominees</h3>
                        <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${totalShare === 100 ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50'}`}>
                                {totalShare}% PF Share Split
                            </span>
                            <button
                                onClick={openAddNomineeModal}
                                className="px-3.5 py-1.5 bg-black text-white hover:bg-gray-800 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add Nominee
                            </button>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-gray-150 text-gray-500 font-bold uppercase tracking-wider">
                                        <th className="pb-2">Nominee Name</th>
                                        <th className="pb-2">Relationship</th>
                                        <th className="pb-2">Share %</th>
                                        <th className="pb-2">Date of Birth</th>
                                        <th className="pb-2">Aadhaar/ID</th>
                                        <th className="pb-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingNominees ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-6 text-slate-400 font-bold text-xs">
                                                Loading nominees...
                                            </td>
                                        </tr>
                                    ) : nominees.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-8 text-slate-400 font-bold italic text-xs">
                                                No PF nominees registered for this profile yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        nominees.map((nom) => (
                                            <tr key={nom.id} className="border-b border-gray-50 hover:bg-slate-50/30 text-slate-700">
                                                <td className="py-3 font-bold text-slate-800">{nom.name}</td>
                                                <td className="py-3 font-medium text-gray-600">{nom.relationship}</td>
                                                <td className="py-3 font-black text-emerald-600">{nom.pf_share_percentage}%</td>
                                                <td className="py-3 text-gray-500 font-semibold">{nom.date_of_birth ? formatDateSafe(nom.date_of_birth) : 'N/A'}</td>
                                                <td className="py-3 font-mono text-slate-500">{nom.aadhaar_number || 'N/A'}</td>
                                                <td className="py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={() => openEditNomineeModal(nom)} 
                                                            className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer"
                                                            title="Edit Nominee"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteNomineeClick(nom)} 
                                                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                                                            title="Delete Nominee"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Dynamic HR Letters & Increment Generator */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm p-6 space-y-4">
                    <h3 className="text-lg font-bold text-slate-800">HR Documents & Letters</h3>
                    <p className="text-xs text-gray-500">Download dynamic, digitally-signed official letters generated based on active employee history and payroll bands.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={async () => {
                                const { default: jsPDFLib } = await import('jspdf')
                                const doc = new jsPDFLib()
                                doc.setFont('helvetica', 'normal')
                                doc.setFontSize(22)
                                doc.text('ANNUAL SALARY INCREMENT LETTER', 20, 40)
                                doc.setFontSize(11)
                                doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 50)
                                doc.text(`To,`, 20, 65)
                                doc.setFont('helvetica', 'bold')
                                doc.text(`${currentEmployee.first_name} ${currentEmployee.last_name}`, 20, 70)
                                doc.setFont('helvetica', 'normal')
                                doc.text(`Department: ${currentEmployee.department || 'Operations'}`, 20, 75)
                                doc.text(`Employee ID: ${currentEmployee.employee_id}`, 20, 80)
                                doc.text(`Dear ${currentEmployee.first_name},`, 20, 95)
                                doc.text(`We are pleased to inform you that your annual compensation package has been revised based on your exceptional performance in the preceding financial year.`, 20, 110, { maxWidth: 170 })
                                doc.text(`Effective immediately, your revised basic monthly salary stands at: INR ${Number(currentEmployee.salary || 45000).toLocaleString()}. Your revised total annual package is estimated at INR ${(Number(currentEmployee.salary || 45000) * 12).toLocaleString()}/-`, 20, 125, { maxWidth: 170 })
                                doc.text(`All other terms and conditions of your employment contract remain unchanged. We appreciate your dedication and look forward to your continued contribution to the company's growth.`, 20, 145, { maxWidth: 170 })
                                doc.text(`Sincerely,`, 20, 180)
                                doc.setFont('helvetica', 'bold')
                                doc.text(`Human Resource Department`, 20, 190)
                                doc.save(`${currentEmployee.first_name}_Salary_Increment_Letter.pdf`)
                            }}
                            className="p-4 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/20 rounded-xl flex flex-col items-center justify-center text-center transition-all group cursor-pointer"
                        >
                            <FileText className="w-8 h-8 text-blue-600 group-hover:scale-110 transition-transform mb-2" />
                            <span className="text-xs font-bold text-slate-800">Increment Letter</span>
                            <span className="text-[9px] text-gray-500 mt-1 font-semibold">FY 2026 Revision</span>
                        </button>

                        <button
                            onClick={async () => {
                                const { default: jsPDFLib } = await import('jspdf')
                                const doc = new jsPDFLib()
                                doc.setFont('helvetica', 'normal')
                                doc.setFontSize(22)
                                doc.text('NO OBJECTION CERTIFICATE (NOC)', 20, 40)
                                doc.setFontSize(11)
                                doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 50)
                                doc.text(`TO WHOMSOEVER IT MAY CONCERN`, 20, 70)
                                doc.text(`This is to certify that ${currentEmployee.first_name} ${currentEmployee.last_name} is a permanent employee of our organization, currently working under the designation of ${currentEmployee.designation || 'Specialist'} within the ${currentEmployee.department || 'Operations'} department.`, 20, 85, { maxWidth: 170 })
                                doc.text(`Our organization has no objection to the employee pursuing professional upskilling programs or administrative applications as declared in official internal request logs.`, 20, 110, { maxWidth: 170 })
                                doc.text(`This certificate is issued upon the specific request of the employee without any liability on behalf of the company.`, 20, 130, { maxWidth: 170 })
                                doc.text(`Sincerely,`, 20, 160)
                                doc.setFont('helvetica', 'bold')
                                doc.text(`Human Resource Director`, 20, 170)
                                doc.save(`${currentEmployee.first_name}_NOC_Letter.pdf`)
                            }}
                            className="p-4 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/20 rounded-xl flex flex-col items-center justify-center text-center transition-all group cursor-pointer"
                        >
                            <FileText className="w-8 h-8 text-indigo-600 group-hover:scale-110 transition-transform mb-2" />
                            <span className="text-xs font-bold text-slate-800">NOC Certificate</span>
                            <span className="text-[9px] text-gray-500 mt-1 font-semibold">Standard Clearance</span>
                        </button>

                        <button
                            onClick={async () => {
                                const { default: jsPDFLib } = await import('jspdf')
                                const doc = new jsPDFLib()
                                doc.setFont('helvetica', 'normal')
                                doc.setFontSize(22)
                                doc.text('EXPERIENCE & CONDUCT TESTIMONIAL', 20, 40)
                                doc.setFontSize(11)
                                doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 50)
                                doc.text(`TO WHOMSOEVER IT MAY CONCERN`, 20, 70)
                                doc.text(`This is to certify that ${currentEmployee.first_name} ${currentEmployee.last_name} has been employed with our organization from ${formatDateSafe(currentEmployee.joining_date)} to Present. During this tenure, they served with distinction in the role of ${currentEmployee.designation || 'Associate'}.`, 20, 85, { maxWidth: 170 })
                                doc.text(`Their conduct, general behavior, and technical capabilities have been found exemplary. They demonstrate strong analytical skills, professional integrity, and teamwork capabilities.`, 20, 110, { maxWidth: 170 })
                                doc.text(`We wish them the absolute best in all their future career pursuits.`, 20, 130, { maxWidth: 170 })
                                doc.text(`Sincerely,`, 20, 155)
                                doc.setFont('helvetica', 'bold')
                                doc.text(`Managing Director`, 20, 165)
                                doc.save(`${currentEmployee.first_name}_Experience_Certificate.pdf`)
                            }}
                            className="p-4 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/20 rounded-xl flex flex-col items-center justify-center text-center transition-all group cursor-pointer"
                        >
                            <FileText className="w-8 h-8 text-emerald-600 group-hover:scale-110 transition-transform mb-2" />
                            <span className="text-xs font-bold text-slate-800">Experience Certificate</span>
                            <span className="text-[9px] text-gray-500 mt-1 font-semibold">Official Testimony</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm h-fit">
                <div className="px-6 py-4 border-b border-gray-250 bg-gray-50/50">
                    <h3 className="text-lg font-bold text-slate-805">Role History</h3>
                </div>
                <div className="p-6">
                    <div className="relative pl-8 space-y-8 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-blue-100">
                        <div className="relative">
                            <span className="absolute -left-8.5 top-0.5 w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow text-white flex items-center justify-center text-[10px] font-bold">1</span>
                            <p className="text-sm font-bold text-blue-700">{currentEmployee.designation || 'Current Role'}</p>
                            <p className="text-xs text-gray-500">Current Position</p>
                            <p className="text-xs font-bold text-slate-800 mt-1">{formatDateSafe(currentEmployee.joining_date, { month: 'short', year: 'numeric' })} - Present</p>
                            <p className="text-xs text-gray-600 mt-1 leading-relaxed">Leading responsibilities in {currentEmployee.department || 'core operations'}.</p>
                        </div>
                        <div className="relative">
                            <span className="absolute -left-8.5 top-0.5 w-6 h-6 rounded-full bg-gray-100 border-2 border-white shadow text-gray-600 flex items-center justify-center text-[10px] font-bold">2</span>
                            <p className="text-sm font-bold text-slate-800">Associate {currentEmployee.designation || 'Role'}</p>
                            <p className="text-xs text-gray-500">Career Progression</p>
                            <p className="text-xs font-bold text-slate-800 mt-1">Initial Phase</p>
                            <p className="text-xs text-gray-600 mt-1 leading-relaxed">Built foundation and delivered key team objectives.</p>
                        </div>
                    </div>
                    <button onClick={() => setShowCareerPathModal(true)} className="w-full mt-6 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold transition">
                        View Full Career Path
                    </button>
                </div>
            </div>

            {/* Career Path Modal */}
            {showCareerPathModal && (
                <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="text-lg font-bold text-slate-800">Career Path</h3>
                            <button onClick={() => setShowCareerPathModal(false)} className="p-2 rounded-full hover:bg-gray-105 transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-1 before:bottom-1 before:w-px before:bg-blue-200">
                                {[
                                    {
                                        title: currentEmployee?.designation || 'Current Role',
                                        period: `${formatDateSafe(currentEmployee?.joining_date || '', { month: 'short', year: 'numeric' })} - Present`,
                                        note: `Leading responsibilities in ${currentEmployee?.department || 'the team'}.`
                                    },
                                    {
                                        title: `Associate ${currentEmployee?.designation || 'Role'}`,
                                        period: 'Initial Phase',
                                        note: 'Delivered critical tasks and built cross-functional collaboration.'
                                    },
                                    {
                                        title: 'Onboarding Stage',
                                        period: 'First 3 months',
                                        note: 'Completed induction, system access, and mandatory trainings.'
                                    }
                                ].map((item, idx) => (
                                    <div key={`${item.title}-${idx}`} className="relative">
                                        <span className={`absolute -left-8 top-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{idx + 1}</span>
                                        <p className="text-base font-bold text-slate-800">{item.title}</p>
                                        <p className="text-xs font-bold text-blue-600 mt-0.5">{item.period}</p>
                                        <p className="text-xs text-gray-500 mt-1">{item.note}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button onClick={() => setShowCareerPathModal(false)} className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Interactive Organization Chart Section */}
            <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm p-6 mt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-150 pb-4 mb-8">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <GitCommit className="w-5 h-5 text-blue-500 rotate-90" />
                            Interactive Organization Chart
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Explore your reporting line, peers, and direct reports dynamically.</p>
                    </div>
                    <div className="flex items-center gap-2 mt-3 sm:mt-0">
                        {peers.length > 0 && (
                            <button 
                                onClick={() => setShowPeers(!showPeers)}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                                    showPeers ? 'bg-blue-50 border-blue-105 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-650'
                                }`}
                            >
                                {showPeers ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                Peers ({peers.length})
                            </button>
                        )}
                        {reports.length > 0 && (
                            <button 
                                onClick={() => setShowReports(!showReports)}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                                    showReports ? 'bg-blue-50 border-blue-105 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-650'
                                }`}
                            >
                                {showReports ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                Reports ({reports.length})
                            </button>
                        )}
                    </div>
                </div>

                {loadingOrg ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-2 text-xs font-bold text-gray-400">
                        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                        Loading Organization Tree...
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50/50 rounded-2xl border border-gray-100 min-h-[400px] overflow-auto">
                        
                        {/* Manager Tier */}
                        {(managerName || managerObj) && (
                            <div className="flex flex-col items-center mb-6 relative">
                                <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 w-56 flex flex-col items-center text-center">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-2">
                                        <User className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-800">{managerObj ? getFullName(managerObj) : managerName}</h4>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{managerObj?.designation || 'Reporting Manager'}</p>
                                    <span className="mt-1.5 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[9px] font-black text-indigo-700">Manager</span>
                                </div>
                                <div className="w-0.5 h-6 bg-blue-200 mt-2" />
                            </div>
                        )}

                        {/* Self & Peers Tier */}
                        <div className="flex flex-col items-center relative w-full">
                            
                            {/* Peers Header connector line */}
                            {showPeers && peers.length > 0 && (
                                <div className="absolute top-0 left-12 right-12 h-0.5 bg-blue-100" />
                            )}

                            <div className="flex flex-wrap justify-center items-start gap-8 w-full relative pt-4">
                                
                                {/* Peers Cards */}
                                {showPeers && peers.map(peer => (
                                    <div key={peer.id} className="flex flex-col items-center relative">
                                        <div className="absolute -top-4 w-0.5 h-4 bg-blue-100" />
                                        <div className="p-4 bg-white border border-gray-150 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 w-52 text-center flex flex-col items-center opacity-85 hover:opacity-100">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-2">
                                                <User className="w-4 h-4 text-slate-500" />
                                            </div>
                                            <h4 className="text-xs font-bold text-slate-700">{getFullName(peer)}</h4>
                                            <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">{peer.designation || 'Team Member'}</p>
                                        </div>
                                    </div>
                                ))}

                                {/* Self Card (Active Employee - Glowing) */}
                                <div className="flex flex-col items-center relative">
                                    {(managerName || (showPeers && peers.length > 0)) && (
                                        <div className="absolute -top-4 w-0.5 h-4 bg-blue-200" />
                                    )}
                                    <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 border border-blue-400 rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/25 transition-all duration-300 w-56 text-center flex flex-col items-center ring-4 ring-blue-100 scale-105 z-10 text-white animate-fade-in">
                                        <div className="w-10 h-10 rounded-full bg-white/20 border border-white/35 flex items-center justify-center mb-2 shadow-sm">
                                            <User className="w-5 h-5 text-white" />
                                        </div>
                                        <h4 className="text-xs font-black">{selfName}</h4>
                                        <p className="text-[9px] text-blue-105 font-bold uppercase mt-0.5">{currentEmployee.designation || 'Active Role'}</p>
                                        <span className="mt-2 px-2.5 py-0.5 rounded-full bg-white text-blue-600 text-[9px] font-black uppercase tracking-wider animate-pulse shadow-sm">You</span>
                                    </div>
                                    {showReports && reports.length > 0 && (
                                        <div className="w-0.5 h-6 bg-blue-200 mt-2" />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Direct Reports Tier */}
                        {showReports && reports.length > 0 && (
                            <div className="flex flex-col items-center relative w-full mt-4">
                                {reports.length > 1 && (
                                    <div className="absolute top-0 left-12 right-12 h-0.5 bg-blue-100" />
                                )}
                                <div className="flex flex-wrap justify-center items-start gap-8 w-full pt-4">
                                    {reports.map(report => (
                                        <div key={report.id} className="flex flex-col items-center relative">
                                            <div className="absolute -top-4 w-0.5 h-4 bg-blue-100" />
                                            <div className="p-4 bg-white border border-gray-150 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 w-52 text-center flex flex-col items-center">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-2">
                                                    <User className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <h4 className="text-xs font-bold text-slate-700">{getFullName(report)}</h4>
                                                <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">{report.designation || 'Team Member'}</p>
                                                <span className="mt-1.5 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[8px] font-black text-blue-600 uppercase">Direct Report</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </div>

            {/* Add / Edit Nominee Modal */}
            {isNomineeModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-150 animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><User className="w-4 h-4" /></span>
                                <h3 className="text-base font-bold text-slate-800">{editingNominee ? 'Edit PF Nominee' : 'Register PF Nominee'}</h3>
                            </div>
                            <button onClick={() => setIsNomineeModalOpen(false)} className="p-1.5 rounded-full hover:bg-slate-100 transition">
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveNominee} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Nominee Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none ${nomineeFormErrors.name ? 'border-red-500' : 'border-gray-200'}`}
                                    placeholder="Enter full name"
                                    value={nomineeForm.name}
                                    onChange={handleNomineeInputChange}
                                />
                                {nomineeFormErrors.name && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{nomineeFormErrors.name}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Relationship *</label>
                                    <select
                                        name="relationship"
                                        required
                                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none ${nomineeFormErrors.relationship ? 'border-red-500' : 'border-gray-200'}`}
                                        value={nomineeForm.relationship}
                                        onChange={handleNomineeInputChange}
                                    >
                                        <option value="">Select</option>
                                        <option value="Spouse">Spouse</option>
                                        <option value="Child">Child</option>
                                        <option value="Father">Father</option>
                                        <option value="Mother">Mother</option>
                                        <option value="Brother">Brother</option>
                                        <option value="Sister">Sister</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    {nomineeFormErrors.relationship && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{nomineeFormErrors.relationship}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Share % *</label>
                                    <input
                                        type="number"
                                        name="pf_share_percentage"
                                        required
                                        step="0.01"
                                        min="0.01"
                                        max="100"
                                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none ${nomineeFormErrors.pf_share_percentage ? 'border-red-500' : 'border-gray-200'}`}
                                        placeholder="e.g. 50"
                                        value={nomineeForm.pf_share_percentage}
                                        onChange={handleNomineeInputChange}
                                    />
                                    {nomineeFormErrors.pf_share_percentage && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 leading-tight">{nomineeFormErrors.pf_share_percentage}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Date of Birth *</label>
                                    <input
                                        type="date"
                                        name="date_of_birth"
                                        required
                                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none ${nomineeFormErrors.date_of_birth ? 'border-red-500' : 'border-gray-200'}`}
                                        value={nomineeForm.date_of_birth}
                                        onChange={handleNomineeInputChange}
                                    />
                                    {nomineeFormErrors.date_of_birth && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{nomineeFormErrors.date_of_birth}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Aadhaar/ID <span className="text-[10px] text-gray-400 font-normal">(Optional)</span></label>
                                    <input
                                        type="text"
                                        name="aadhaar_number"
                                        maxLength="12"
                                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none ${nomineeFormErrors.aadhaar_number ? 'border-red-500' : 'border-gray-200'}`}
                                        placeholder="12 digit Aadhaar"
                                        value={nomineeForm.aadhaar_number}
                                        onChange={handleNomineeInputChange}
                                    />
                                    {nomineeFormErrors.aadhaar_number && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{nomineeFormErrors.aadhaar_number}</p>}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsNomineeModalOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingNominee}
                                    className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                    {savingNominee ? 'Saving...' : 'Save Nominee'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Delete Nominee Modal */}
            {showNomineeDeleteModal && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-red-100 animate-in zoom-in-95 duration-200">
                        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-red-650" />
                            <h3 className="text-sm font-bold text-red-950">Remove PF Nominee</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-xs font-bold text-slate-700 leading-relaxed">
                                Are you sure you want to permanently remove <span className="font-extrabold text-slate-950">"{nomineeToDelete?.name}"</span> from your PF beneficiaries registry? This action is immediate.
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        setShowNomineeDeleteModal(false)
                                        setNomineeToDelete(null)
                                    }}
                                    disabled={deletingNominee}
                                    className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteNominee}
                                    disabled={deletingNominee}
                                    className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                    {deletingNominee ? 'Removing...' : 'Remove'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
