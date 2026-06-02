import { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useCompany } from '../context/CompanyContext'
import { devLog } from '../lib/devLogger'
import { supabase } from '../lib/supabase'
import { applyCompanyFilter, withCompanyScope, getActiveCompanyId } from '../services/tenantScope'
import { usePlanEntitlements } from '../hooks/usePlanEntitlements'
import { Plus, Search, Users, Camera, Upload, ArrowLeft, Edit, Trash2, ChevronLeft, ChevronRight, User, Briefcase, IndianRupee, MapPin, Loader2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { EmployeeRowSkeleton } from '../components/ui/SkeletonLoader'
import BulkImportModal from '../components/BulkImportModal'
import SearchableSelect from '../components/ui/SearchableSelect'

const STATE_OPTIONS = [
    {
        label: 'States',
        options: [
            'Andhra Pradesh',
            'Arunachal Pradesh',
            'Assam',
            'Bihar',
            'Chhattisgarh',
            'Goa',
            'Gujarat',
            'Haryana',
            'Himachal Pradesh',
            'Jharkhand',
            'Karnataka',
            'Kerala',
            'Madhya Pradesh',
            'Maharashtra',
            'Manipur',
            'Meghalaya',
            'Mizoram',
            'Nagaland',
            'Odisha',
            'Punjab',
            'Rajasthan',
            'Sikkim',
            'Tamil Nadu',
            'Telangana',
            'Tripura',
            'Uttar Pradesh',
            'Uttarakhand',
            'West Bengal'
        ]
    },
    {
        label: 'Union Territories',
        options: [
            'Andaman and Nicobar Islands',
            'Chandigarh',
            'Dadra and Nagar Haveli and Daman and Diu',
            'Delhi',
            'Jammu and Kashmir',
            'Ladakh',
            'Lakshadweep',
            'Puducherry'
        ]
    }
]

const DEFAULT_JOB_GRADES = [
    { id: 'default-l1', grade_code: 'L1', name: 'L1 - Junior Associate', min_salary: 10000, max_salary: 40000 },
    { id: 'default-l2', grade_code: 'L2', name: 'L2 - Associate', min_salary: 40000, max_salary: 80000 },
    { id: 'default-l3', grade_code: 'L3', name: 'L3 - Senior Associate', min_salary: 80000, max_salary: 150000 },
    { id: 'default-l4', grade_code: 'L4', name: 'L4 - Lead', min_salary: 150000, max_salary: 300000 },
    { id: 'default-l5', grade_code: 'L5', name: 'L5 - Principal', min_salary: 300000, max_salary: 800000 }
]

const CONTRACT_TYPES = ['Permanent', 'Contract', 'Intern', 'Consultant']

const getDefaultContractType = (employmentType) => {
    if (employmentType === 'consultant') return 'Consultant'
    if (employmentType === 'contract') return 'Contract'
    return 'Permanent'
}

const normalizeContractType = (contractType, employmentType) => {
    return CONTRACT_TYPES.includes(contractType) ? contractType : getDefaultContractType(employmentType)
}

export default function Employees() {
    const location = useLocation()
    const navigate = useNavigate()
    const toast = useToast()
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [editingEmployee, setEditingEmployee] = useState(null)
    const [successMessage, setSuccessMessage] = useState('')
    const [errors, setErrors] = useState({})
    const [sameAddress, setSameAddress] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [employeeToDelete, setEmployeeToDelete] = useState(null)
    const [profilePhotoFile, setProfilePhotoFile] = useState(null)
    const [profilePhotoPreview, setProfilePhotoPreview] = useState('')
    const [removeProfilePhoto, setRemoveProfilePhoto] = useState(false)
    const [jobGrades, setJobGrades] = useState([])
    const [loadingJobGrades, setLoadingJobGrades] = useState(false)
    const [showExtendModal, setShowExtendModal] = useState(false)
    const [employeeForProbation, setEmployeeForProbation] = useState(null)
    const [extensionMonths, setExtensionMonths] = useState('1')
    const [probationActionLoading, setProbationActionLoading] = useState(false)
    const employeesPerPage = 10
    const { isAdmin } = useAuth()
    const { activeCompanyId } = useCompany()
    const { entitlements, canAddUsage } = usePlanEntitlements()
    const [activeSection, setActiveSection] = useState('basic-info')

    const scrollToSection = (id) => {
        setActiveSection(id)
        const el = document.getElementById(id)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    useEffect(() => {
        if (!isModalOpen) return

        const sections = ['basic-info', 'employment', 'salary-finance', 'address-documents']
        const observerCallback = (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id)
                }
            })
        }

        const observerOptions = {
            root: null,
            rootMargin: '-10% 0px -70% 0px',
            threshold: 0.1
        }

        const observer = new IntersectionObserver(observerCallback, observerOptions)
        sections.forEach((id) => {
            const el = document.getElementById(id)
            if (el) observer.observe(el)
        })

        return () => {
            observer.disconnect()
        }
    }, [isModalOpen])

    const [formData, setFormData] = useState({
        employee_id: '',
        first_name: '',
        last_name: '',
        email: '',
        gender: '',
        marital_status: '',
        dob: '',
        joining_date: '',
        phone: '',
        emergency_contact_person: '',
        emergency_contact_number: '',
        designation: '',
        current_address: '',
        permanent_address: '',
        state: '',
        department: '',
        reporting_person: '',
        salary: '',
        role: 'employee',
        employment_type: 'permanent',
        probation_period: '',
        probation_status: 'pending',
        probation_end_date: '',
        notice_period_days: '',
        work_location: '',
        job_grade: '',
        contract_type: 'Permanent',
        contract_end_date: '',
        biometric_id: '',
        pan_number: '',
        aadhaar_number: '',
        uan_number: '',
        esi_number: '',
        esic_number: '',
        epf_member_id: '',
        esic_ip_no: '',
        bank_name: '',
        bank_account_number: '',
        ifsc_code: '',
        hold_payroll: false,
        is_specially_abled: false,
        whatsapp_enabled: false,
        profile_photo_url: '',
        id_proof_url: '',
        address_proof_url: '',
        status: 'active'
    })

    useEffect(() => {
        fetchEmployees()
        fetchJobGrades(activeCompanyId)
    }, [activeCompanyId])

    const selectedJobGrade = useMemo(() => {
        if (!formData.job_grade) return null
        return jobGrades.find((grade) => grade.grade_code === formData.job_grade || grade.name === formData.job_grade)
    }, [formData.job_grade, jobGrades])

    useEffect(() => {
        const editEmployeeId = location.state?.editEmployeeId
        if (!editEmployeeId || employees.length === 0) return

        const targetEmployee = employees.find((emp) => emp.id === editEmployeeId)
        if (!targetEmployee) return

        startEditing(targetEmployee)
        navigate(location.pathname, { replace: true, state: {} })
    }, [location.pathname, location.state, employees, navigate])

    const generateNextEmployeeId = async () => {
        try {
            const prefix = 'EMP'

            let query = supabase
                .from('employees')
                .select('employee_id')
                .ilike('employee_id', `${prefix}%`)
            query = applyCompanyFilter(query)

            const { data, error } = await query
            if (error) throw error

            let nextSerial = 1
            if (data && data.length > 0) {
                const serials = data
                    .map(emp => {
                        const numericPart = emp.employee_id?.substring(prefix.length)
                        const val = parseInt(numericPart, 10)
                        return isNaN(val) ? null : val
                    })
                    .filter(val => val !== null)

                if (serials.length > 0) {
                    nextSerial = Math.max(...serials) + 1
                }
            }

            const nextId = `${prefix}${nextSerial.toString().padStart(3, '0')}`
            setFormData(prev => ({ ...prev, employee_id: nextId }))
        } catch (error) {
            console.error('Error generating employee ID:', error)
        }
    }

    const fetchJobGrades = async (companyId = activeCompanyId) => {
        try {
            setLoadingJobGrades(true)
            let query = supabase
                .from('job_grades')
                .select('*')
                .order('min_salary', { ascending: true })

            if (companyId) query = query.eq('company_id', companyId)

            const { data, error } = await query
            if (error) {
                if (error.code === '42P01') {
                    setJobGrades(DEFAULT_JOB_GRADES)
                    return
                }
                throw error
            }

            setJobGrades(data?.length ? data : DEFAULT_JOB_GRADES)
        } catch (error) {
            console.error('Error fetching job grades:', error)
            setJobGrades(DEFAULT_JOB_GRADES)
            toast.error('Failed to load job grades. Showing default grades.')
        } finally {
            setLoadingJobGrades(false)
        }
    }

    const fetchEmployees = async () => {
        try {
            let query = supabase
                .from('employees')
                .select('*')
                .order('created_at', { ascending: false })

            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            setEmployees(data)
        } catch (error) {
            console.error('Error fetching employees:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleStatus = async (employee) => {
        if (!isAdmin) return
        const newStatus = employee.status === 'active' ? 'inactive' : 'active'
        try {
            const { error } = await supabase
                .from('employees')
                .update({ status: newStatus })
                .eq('id', employee.id)

            if (error) throw error
            toast.success(`Employee marked as ${newStatus}`)
            fetchEmployees()
        } catch (error) {
            toast.error(error.message)
        }
    }

    const parseProbationMonths = (value) => {
        const months = parseInt(value, 10)
        return Number.isFinite(months) && months > 0 ? months : 0
    }

    const getProbationInfo = (employee) => {
        const months = parseProbationMonths(employee?.probation_period)
        if (!employee?.joining_date || months === 0 || employee?.probation_status === 'confirmed') {
            return { active: false, months, daysLeft: null, endDate: null }
        }

        const joiningDate = new Date(employee.joining_date)
        const endDate = new Date(joiningDate)
        endDate.setMonth(endDate.getMonth() + months)
        const today = new Date()
        const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))

        return {
            active: daysLeft >= 0,
            months,
            daysLeft,
            endDate
        }
    }

    const isProbationActionable = (employee) => {
        if (!employee || employee.probation_status === 'confirmed') return false
        const months = parseProbationMonths(employee.probation_period)
        return months > 0 || ['pending', 'extended'].includes(employee.probation_status)
    }

    const formatDate = (date) => {
        if (!date) return ''
        return new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
    }

    const downloadProbationLetter = async (employee, type, details = {}) => {
        const { default: jsPDF } = await import('jspdf')
        const doc = new jsPDF({ unit: 'mm', format: 'a4' })
        const employeeName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
        const today = formatDate(new Date())
        const title = type === 'confirmation' ? 'Probation Confirmation Letter' : 'Probation Extension Letter'
        const fileSafeName = employeeName.replace(/[^a-z0-9]+/gi, '_') || employee.employee_id || 'employee'

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(16)
        doc.text(title, 20, 25)
        doc.setFontSize(10)
        doc.text(`Date: ${today}`, 20, 35)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.text(`To,`, 20, 55)
        doc.text(employeeName, 20, 62)
        doc.text(`${employee.designation || 'Employee'}${employee.department ? `, ${employee.department}` : ''}`, 20, 69)
        doc.text(`Employee ID: ${employee.employee_id || '-'}`, 20, 76)

        const body = type === 'confirmation'
            ? `We are pleased to confirm your employment with effect from ${today}. Your probation period has been completed successfully, and your employment status is now active. We appreciate your contribution and look forward to your continued work with the organization.`
            : `This is to inform you that your probation period has been extended by ${details.extensionMonths} month(s). Your revised probation period is ${details.totalMonths} month(s), ending on ${formatDate(details.endDate)}. During this period, your performance and role expectations will continue to be reviewed.`

        const lines = doc.splitTextToSize(body, 170)
        doc.text(lines, 20, 95)
        doc.text('Regards,', 20, 145)
        doc.text('HR Department', 20, 153)

        const blob = doc.output('blob')
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${type === 'confirmation' ? 'probation_confirmation' : 'probation_extension'}_${fileSafeName}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const openExtendProbation = (employee) => {
        setEmployeeForProbation(employee)
        setExtensionMonths('1')
        setShowExtendModal(true)
    }

    const handleExtendProbation = async () => {
        if (!employeeForProbation) return
        const extension = parseInt(extensionMonths, 10)
        if (!Number.isFinite(extension) || extension <= 0) {
            toast.error('Enter a valid extension in months.')
            return
        }

        try {
            setProbationActionLoading(true)
            const currentMonths = parseProbationMonths(employeeForProbation.probation_period)
            const totalMonths = currentMonths + extension
            const joiningDate = new Date(employeeForProbation.joining_date)
            const endDate = new Date(joiningDate)
            endDate.setMonth(endDate.getMonth() + totalMonths)

            const companyId = getActiveCompanyId()
            let query = supabase
                .from('employees')
                .update({
                    probation_period: String(totalMonths),
                    probation_status: 'extended',
                    probation_end_date: endDate.toISOString().split('T')[0]
                })
                .eq('id', employeeForProbation.id)
            if (companyId) query = query.eq('company_id', companyId)

            const { error } = await query

            if (error) throw error
            await downloadProbationLetter(employeeForProbation, 'extension', { extensionMonths: extension, totalMonths, endDate })
            toast.success('Probation extended and letter downloaded.')
            setShowExtendModal(false)
            setEmployeeForProbation(null)
            fetchEmployees()
        } catch (error) {
            toast.error(error.message || 'Failed to extend probation.')
        } finally {
            setProbationActionLoading(false)
        }
    }

    const handleConfirmEmployee = async (employee) => {
        try {
            setProbationActionLoading(true)
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('employees')
                .update({
                    status: 'active',
                    probation_period: '0',
                    probation_status: 'confirmed',
                    probation_end_date: null
                })
                .eq('id', employee.id)
            if (companyId) query = query.eq('company_id', companyId)

            const { error } = await query

            if (error) throw error
            await downloadProbationLetter(employee, 'confirmation')
            toast.success('Employee confirmed and letter downloaded.')
            fetchEmployees()
        } catch (error) {
            toast.error(error.message || 'Failed to confirm employee.')
        } finally {
            setProbationActionLoading(false)
        }
    }

    const startEditing = (employee) => {
        setEditingEmployee(employee)
        setFormData({
            employee_id: employee.employee_id || '',
            first_name: employee.first_name,
            last_name: employee.last_name,
            email: employee.email,
            gender: employee.gender || '',
            marital_status: employee.marital_status || '',
            dob: employee.dob || '',
            joining_date: employee.joining_date || '',
            phone: employee.phone || '',
            emergency_contact_person: employee.emergency_contact_person || '',
            emergency_contact_number: employee.emergency_contact_number || '',
            designation: employee.designation || '',
            current_address: employee.current_address || '',
            permanent_address: employee.permanent_address || '',
            state: employee.state || '',
            department: employee.department || '',
            reporting_person: employee.reporting_person || '',
            salary: employee.salary ? employee.salary.toString() : '',
            role: employee.role || 'employee',
            employment_type: employee.employment_type || 'permanent',
            probation_period: employee.probation_period || '',
            probation_status: employee.probation_status || 'pending',
            probation_end_date: employee.probation_end_date || '',
            notice_period_days: employee.notice_period_days || '',
            work_location: employee.work_location || '',
            job_grade: employee.job_grade || '',
            contract_type: normalizeContractType(employee.contract_type, employee.employment_type || 'permanent'),
            contract_end_date: employee.contract_end_date || '',
            biometric_id: employee.biometric_id || '',
            pan_number: employee.pan_number || '',
            aadhaar_number: employee.aadhaar_number || '',
            uan_number: employee.uan_number || '',
            esi_number: employee.esi_number || '',
            esic_number: employee.esic_number || '',
            epf_member_id: employee.epf_member_id || '',
            esic_ip_no: employee.esic_ip_no || '',
            bank_name: employee.bank_name || '',
            bank_account_number: employee.bank_account_number || '',
            ifsc_code: employee.ifsc_code || '',
            hold_payroll: employee.hold_payroll || false,
            is_specially_abled: employee.is_specially_abled || false,
            whatsapp_enabled: employee.whatsapp_enabled || false,
            profile_photo_url: employee.profile_photo_url || '',
            id_proof_url: employee.id_proof_url || '',
            address_proof_url: employee.address_proof_url || '',
            status: employee.status || 'active'
        })
        setProfilePhotoPreview(employee.profile_photo_url || '')
        setProfilePhotoFile(null)
        setRemoveProfilePhoto(false)
        setErrors({})
        setIsModalOpen(true)
    }

    const startAddingEmployee = () => {
        if (!canAddUsage('employees')) {
            const limit = entitlements?.limits?.employees
            toast.error(`Employee limit reached for ${entitlements?.plan?.name || 'this plan'}${limit ? ` (${limit} active employees)` : ''}. Upgrade the subscription to add more.`)
            return
        }

        setEditingEmployee(null)
        setFormData({
            employee_id: '',
            first_name: '',
            last_name: '',
            email: '',
            gender: '',
            marital_status: '',
            dob: '',
            joining_date: '',
            phone: '',
            emergency_contact_person: '',
            emergency_contact_number: '',
            designation: '',
            current_address: '',
            permanent_address: '',
            state: '',
            department: '',
            reporting_person: '',
            salary: '',
            role: 'employee',
            employment_type: 'permanent',
            probation_period: '',
            probation_status: 'pending',
            probation_end_date: '',
            notice_period_days: '',
            work_location: '',
            job_grade: '',
            contract_type: 'Permanent',
            contract_end_date: '',
            biometric_id: '',
            pan_number: '',
            aadhaar_number: '',
            uan_number: '',
            esi_number: '',
            esic_number: '',
            epf_member_id: '',
            esic_ip_no: '',
            bank_name: '',
            bank_account_number: '',
            ifsc_code: '',
            hold_payroll: false,
            is_specially_abled: false,
            whatsapp_enabled: false,
            profile_photo_url: '',
            id_proof_url: '',
            address_proof_url: '',
            status: 'active'
        })
        setErrors({})
        setSameAddress(false)
        setProfilePhotoFile(null)
        setProfilePhotoPreview('')
        setRemoveProfilePhoto(false)
        generateNextEmployeeId()
        setIsModalOpen(true)
    }

    const openBulkImport = () => {
        if (!canAddUsage('employees')) {
            toast.error(`Employee limit reached for ${entitlements?.plan?.name || 'this plan'}. Upgrade the subscription before importing more employees.`)
            return
        }
        setIsImportModalOpen(true)
    }

    const handleProfilePhotoChange = (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
        if (!allowedTypes.includes(file.type)) {
            setErrors(prev => ({ ...prev, submit: 'Profile picture must be JPG, GIF, or PNG.' }))
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, submit: 'Profile picture must be under 2MB.' }))
            return
        }
        setErrors(prev => ({ ...prev, submit: '' }))
        setProfilePhotoFile(file)
        setRemoveProfilePhoto(false)
        setProfilePhotoPreview(URL.createObjectURL(file))
    }

    const handleRemoveProfilePhoto = () => {
        setProfilePhotoFile(null)
        setProfilePhotoPreview('')
        setRemoveProfilePhoto(true)
    }

    const handleSubmit = async (e, forcedStatus = null) => {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault()
        }
        setLoading(true)
        setSuccessMessage('') // Use setSuccessMessage as it's already defined

        devLog('Attempting to submit form...')

        const currentData = { ...formData }
        if (forcedStatus) {
            currentData.status = forcedStatus
            setFormData(prev => ({ ...prev, status: forcedStatus }))
        }

        // Re-run validation for all fields on submit
        const newErrors = {}
        devLog('Validating form data:', currentData)
        Object.keys(currentData).forEach(key => {
            const error = validateField(key, currentData[key])
            if (error) {
                newErrors[key] = error
                devLog(`Validation failed for ${key}: ${error}`)
            }
        })
        setErrors(newErrors)
        const isValid = Object.keys(newErrors).length === 0
        if (!isValid) {
            setLoading(false)
            devLog('Form validation failed with errors:', newErrors)

            // Scroll smoothly and focus the first invalid field
            const firstInvalidFieldName = Object.keys(newErrors)[0]
            const firstInvalidElement = document.getElementsByName(firstInvalidFieldName)[0]
            if (firstInvalidElement) {
                firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                setTimeout(() => {
                    firstInvalidElement.focus()
                }, 400)
            }
            return
        }
        devLog('Form validation passed')

        try {
            const payload = { ...currentData }
            if (payload.salary) {
                payload.salary = parseFloat(payload.salary)
            }
            payload.contract_type = normalizeContractType(payload.contract_type, payload.employment_type)
            if (payload.employment_type === 'permanent') {
                payload.contract_end_date = null
            }
            // Convert empty date strings to null to prevent Postgres 22007 errors
            const dateFields = ['dob', 'joining_date', 'probation_end_date', 'contract_end_date']
            dateFields.forEach(field => {
                if (payload[field] === '') payload[field] = null
            })
            if (removeProfilePhoto) {
                payload.profile_photo_url = ''
            }
            if (profilePhotoFile) {
                const safeName = profilePhotoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
                const targetId = editingEmployee?.id || currentData.employee_id || `new_${Date.now()}`
                const path = `${targetId}/${Date.now()}_${safeName}`
                const { error: uploadError } = await supabase.storage
                    .from('employee-profiles')
                    .upload(path, profilePhotoFile, {
                        contentType: profilePhotoFile.type,
                        upsert: false
                    })
                if (uploadError) throw uploadError
                const { data: publicUrlData } = supabase.storage.from('employee-profiles').getPublicUrl(path)
                payload.profile_photo_url = publicUrlData?.publicUrl || payload.profile_photo_url || ''
            }

            if (editingEmployee) {
                devLog('Updating data in Supabase:', payload)
                const { error } = await supabase
                    .from('employees')
                    .update(payload)
                    .eq('id', editingEmployee.id)
                if (error) throw error
                setSuccessMessage('Employee updated successfully!')
            } else {
                if (!canAddUsage('employees')) {
                    throw new Error(`Employee limit reached for ${entitlements?.plan?.name || 'this plan'}. Upgrade the subscription to add more.`)
                }
                devLog('Sending data to Supabase:', payload)
                const { error } = await supabase
                    .from('employees')
                    .insert([withCompanyScope(payload)])
                if (error) throw error
                setSuccessMessage('Employee added successfully!')
            }

            setIsModalOpen(false)
            setEditingEmployee(null)
            fetchEmployees()
            setFormData({
                employee_id: '', first_name: '', last_name: '', email: '', gender: '',
                marital_status: '', dob: '', joining_date: '', phone: '',
                emergency_contact_person: '', emergency_contact_number: '',
                designation: '', current_address: '', permanent_address: '',
                state: '', department: '', reporting_person: '', salary: '',
                role: 'employee', employment_type: 'permanent',
                probation_period: '', probation_status: 'pending', probation_end_date: '',
                notice_period_days: '', work_location: '', job_grade: '',
                contract_type: 'Permanent', contract_end_date: '', biometric_id: '',
                pan_number: '', aadhaar_number: '', uan_number: '', esi_number: '',
                esic_number: '', epf_member_id: '', esic_ip_no: '',
                bank_name: '', bank_account_number: '', ifsc_code: '',
                hold_payroll: false, is_specially_abled: false, whatsapp_enabled: false,
                profile_photo_url: '', id_proof_url: '', address_proof_url: '', status: 'active'
            })
            setProfilePhotoFile(null)
            setProfilePhotoPreview('')
            setRemoveProfilePhoto(false)
            setErrors({}) // Clear errors on successful submission

            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(''), 3000)
        } catch (error) {
            console.error('Form submission unexpected error:', error)
            setErrors(prev => ({ ...prev, submit: error.message || 'Failed to add/update employee. Please check connection and try again.' }))
        } finally {
            setLoading(false)
        }
    }

    const filteredEmployees = employees.filter(emp =>
        emp.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalPages = Math.ceil(filteredEmployees.length / employeesPerPage)
    const indexOfLastEmployee = currentPage * employeesPerPage
    const indexOfFirstEmployee = indexOfLastEmployee - employeesPerPage
    const currentEmployees = filteredEmployees.slice(indexOfFirstEmployee, indexOfLastEmployee)

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm])

    const handleDeleteClick = (emp) => {
        setEmployeeToDelete(emp)
        setShowDeleteModal(true)
    }

    const validateField = (name, value, data = formData) => {
        let error = ''
        switch (name) {
            case 'employee_id':
                if (!value) error = 'Employee ID is required'
                break
            case 'first_name':
                if (!value || value.trim().length < 3) {
                    error = 'First name is required (min 3 characters)'
                } else if (!/^[A-Za-z\s]+$/.test(value)) {
                    error = 'First name must contain only letters'
                }
                break
            case 'last_name':
                if (value && !/^[A-Za-z\s]+$/.test(value)) {
                    error = 'Last name must contain only letters'
                }
                break
            case 'email': {
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
                if (!value) {
                    error = 'Email address is required'
                } else if (!emailRegex.test(value)) {
                    error = 'Please enter a valid email address (e.g., name@company.com)'
                }
                break
            }
            case 'joining_date':
                if (!value) error = 'Joining date is required'
                break
            case 'department':
                if (!value) error = 'Department is required'
                break
            case 'designation':
                if (!value) error = 'Designation is required'
                break
            case 'salary':
                if (!value || parseFloat(value) <= 0) {
                    error = 'Salary must be a positive number'
                } else {
                    const grade = jobGrades.find((item) => item.grade_code === data.job_grade || item.name === data.job_grade)
                    if (!grade) break
                    const salary = parseFloat(value) * 0.5
                    const minSalary = Number(grade.min_salary)
                    const maxSalary = Number(grade.max_salary)
                    if (Number.isFinite(minSalary) && salary < minSalary) {
                        error = `Salary is below ${grade.name || grade.grade_code} minimum of Rs ${minSalary.toLocaleString('en-IN')}`
                    } else if (Number.isFinite(maxSalary) && salary > maxSalary) {
                        error = `Salary exceeds ${grade.name || grade.grade_code} maximum of Rs ${maxSalary.toLocaleString('en-IN')}`
                    }
                }
                break
            case 'job_grade':
                if (value && data.salary) {
                    const grade = jobGrades.find((item) => item.grade_code === value || item.name === value)
                    if (grade) {
                        const salary = parseFloat(data.salary) * 0.5
                        const minSalary = Number(grade.min_salary)
                        const maxSalary = Number(grade.max_salary)
                        if (Number.isFinite(minSalary) && salary < minSalary) {
                            error = `Current salary is below ${grade.name || grade.grade_code} minimum`
                        } else if (Number.isFinite(maxSalary) && salary > maxSalary) {
                            error = `Current salary exceeds ${grade.name || grade.grade_code} maximum`
                        }
                    }
                }
                break
            case 'phone':
                if (!value) {
                    error = 'Phone number is required'
                } else if (!/^\d{10}$/.test(value)) {
                    error = 'Phone number must be exactly 10 digits'
                }
                break
            case 'pan_number':
                if (value && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value.toUpperCase())) {
                    error = 'Invalid PAN format (e.g., ABCDE1234F)'
                }
                break
            case 'aadhaar_number':
                if (value && !/^\d{12}$/.test(value)) {
                    error = 'Aadhaar must be exactly 12 digits'
                }
                break
            case 'current_address':
                if (!value || value.trim().length < 10) error = 'Current address is required (min 10 characters)'
                break
            case 'permanent_address':
                if (!value || value.trim().length < 10) error = 'Permanent address is required (min 10 characters)'
                break
            case 'emergency_contact_number':
                if (value && !/^\d{10}$/.test(value)) {
                    error = 'Emergency phone must be exactly 10 digits'
                }
                break
            case 'emergency_contact_person':
                if (value && !/^[A-Za-z\s]+$/.test(value)) {
                    error = 'Emergency contact person must contain only letters'
                }
                break
            default:
                break
        }
        return error
    }

    const handleInputChange = (e) => {
        const { name, value } = e.target
        const updatedData = { ...formData, [name]: value }
        if (name === 'employment_type') {
            updatedData.contract_type = getDefaultContractType(value)
            if (value === 'permanent') updatedData.contract_end_date = ''
        }
        if (name === 'current_address' && sameAddress) {
            updatedData.permanent_address = value
        }

        setFormData(prev => {
            const newData = { ...prev, [name]: value }
            if (name === 'employment_type') {
                newData.contract_type = getDefaultContractType(value)
                if (value === 'permanent') newData.contract_end_date = ''
            }

            // Sync addresses if checkbox is checked
            if (name === 'current_address' && sameAddress) {
                newData.permanent_address = value
            }
            return newData
        })

        // Real-time validation
        const fieldError = validateField(name, value, updatedData)
        setErrors(prev => {
            const newErrors = { ...prev, [name]: fieldError }
            if (!fieldError) delete newErrors[name]
            if (name === 'job_grade') {
                const salaryError = validateField('salary', updatedData.salary, updatedData)
                if (salaryError) newErrors.salary = salaryError
                else delete newErrors.salary
            }
            if (name === 'salary') {
                const gradeError = validateField('job_grade', updatedData.job_grade, updatedData)
                if (gradeError) newErrors.job_grade = gradeError
                else delete newErrors.job_grade
            }
            // Verify permanent address too if syncing
            if (name === 'current_address' && sameAddress) {
                const permError = validateField('permanent_address', value)
                if (permError) newErrors.permanent_address = permError
                else delete newErrors.permanent_address
            }
            return newErrors
        })
    }



    const confirmDelete = async () => {
        if (!employeeToDelete) return
        try {
            const { error } = await supabase
                .from('employees')
                .delete()
                .eq('id', employeeToDelete.id)
            if (error) throw error
            toast.success('Employee deleted successfully!')
            fetchEmployees()
        } catch (error) {
            toast.error(error.message)
        } finally {
            setShowDeleteModal(false)
            setEmployeeToDelete(null)
        }
    }


    const maxDate = new Date()
    const maxDateString = maxDate.toISOString().split('T')[0]

    const navigationPills = [
        { id: 'basic-info', label: 'Basic Info', icon: User },
        { id: 'employment', label: 'Employment', icon: Briefcase },
        { id: 'salary-finance', label: 'Salary & Finance', icon: IndianRupee },
        { id: 'address-documents', label: 'Address & Documents', icon: MapPin },
    ]

    return (
        <div className="w-full bg-slate-50 relative">
            {successMessage && (
                <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-4">
                    {successMessage}
                </div>
            )}

            {isModalOpen ? (
                /* Full-Page Takeover Layout */
                <div className="fixed inset-y-0 right-0 left-0 lg:left-64 bg-slate-50 flex flex-col z-20 overflow-y-auto animate-in fade-in duration-200">
                    {/* Top Sticky Header */}
                    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsModalOpen(false)
                                    setEditingEmployee(null)
                                    setProfilePhotoFile(null)
                                    setProfilePhotoPreview('')
                                    setRemoveProfilePhoto(false)
                                }}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-900"
                                aria-label="Discard changes"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-slate-900">
                                    {editingEmployee ? `Edit ${editingEmployee.first_name} ${editingEmployee.last_name || ''}` : 'New Employee'}
                                </h1>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                    formData.status === 'active' 
                                        ? 'bg-green-100 text-green-800 border border-green-200' 
                                        : 'bg-slate-100 text-slate-800 border border-slate-200'
                                }`}>
                                    {formData.status === 'active' ? 'Active' : 'Draft'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsModalOpen(false)
                                    setEditingEmployee(null)
                                    setProfilePhotoFile(null)
                                    setProfilePhotoPreview('')
                                    setRemoveProfilePhoto(false)
                                }}
                                className="text-slate-500 hover:text-slate-900 px-4 py-2.5 font-bold text-sm transition-all rounded-xl hover:bg-slate-100"
                            >
                                Discard
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e, 'inactive')}
                                disabled={loading}
                                className="border border-gray-300 bg-white text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50"
                            >
                                Save as Draft
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e, 'active')}
                                disabled={loading}
                                className="bg-black text-white hover:bg-slate-800 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Save Employee
                            </button>
                        </div>
                    </header>

                    {/* Split-Pane Form Body */}
                    <div className="flex-1">
                        <div className="flex flex-col lg:flex-row gap-8 p-8 max-w-7xl mx-auto w-full pb-24 items-start relative">
                            {/* Inner Left Navigation (Sticky Menu) */}
                            <div className="sticky top-32 h-fit self-start shrink-0 w-full lg:w-64">
                                <div className="space-y-1 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                                    {navigationPills.map((pill) => {
                                        const Icon = pill.icon
                                        const isActive = activeSection === pill.id
                                        return (
                                            <button
                                                key={pill.id}
                                                type="button"
                                                onClick={() => scrollToSection(pill.id)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold text-left ${
                                                    isActive
                                                        ? 'bg-slate-900 text-white shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                                }`}
                                            >
                                                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                                <span>{pill.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Inner Right Form Area (Scrolling Cards) */}
                            <div className="flex-1 space-y-8">
                                {errors.submit && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl shadow-sm font-bold uppercase text-xs">
                                        {errors.submit}
                                    </div>
                                )}

                                {Object.keys(errors).length > 0 && !errors.submit && (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-6 py-4 rounded-2xl shadow-sm font-bold uppercase text-xs">
                                        Please fix the highlighted errors before saving.
                                    </div>
                                )}

                                {/* Card 1: Basic Info */}
                                <section id="basic-info" className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm scroll-mt-24 space-y-6">
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 border-b border-slate-100 pb-4">Basic Info</h2>
                                    
                                    {/* Profile Photo */}
                                    <div className="rounded-xl border border-gray-200 bg-slate-50/50 p-6">
                                        <div className="flex flex-col sm:flex-row items-center gap-6">
                                            <div className="relative w-24 h-24 rounded-full bg-amber-100 border border-amber-200 overflow-hidden flex items-center justify-center text-2xl font-bold text-slate-700 shrink-0">
                                                {profilePhotoPreview ? (
                                                    <img src={profilePhotoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <>{formData.first_name?.[0] || ''}{formData.last_name?.[0] || ''}</>
                                                )}
                                                <span className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-slate-900 text-white border-2 border-white shadow-md flex items-center justify-center">
                                                    <Camera className="w-4 h-4" />
                                                </span>
                                            </div>
                                            <div className="text-center sm:text-left">
                                                <h3 className="text-lg font-bold text-slate-800">Profile Picture</h3>
                                                <p className="text-sm text-gray-500 mt-1">JPG, GIF or PNG. Max size of 2MB.</p>
                                                <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                                    <label className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 cursor-pointer transition-colors shadow-sm animate-in fade-in">
                                                        Change photo
                                                        <input
                                                            type="file"
                                                            accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif"
                                                            className="hidden"
                                                            onChange={handleProfilePhotoChange}
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveProfilePhoto}
                                                        className="text-sm font-bold text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
                                                        disabled={!profilePhotoPreview && !formData.profile_photo_url}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Employee ID *</label>
                                            <input type="text" name="employee_id"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.employee_id ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.employee_id} readOnly
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email Address *</label>
                                            <input type="email" name="email"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.email} onChange={handleInputChange}
                                            />
                                            {errors.email && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.email}</p>}
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Full Name *</label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <input type="text" name="first_name" placeholder="First Name"
                                                    className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.first_name ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                    value={formData.first_name} onChange={handleInputChange}
                                                />
                                                <input type="text" name="last_name" placeholder="Last Name"
                                                    className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.last_name ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                    value={formData.last_name} onChange={handleInputChange}
                                                />
                                            </div>
                                            {(errors.first_name || errors.last_name) && (
                                                <p className="text-red-500 text-[10px] font-bold uppercase mt-1">
                                                    {errors.first_name || errors.last_name}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Gender *</label>
                                            <select name="gender"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.gender ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.gender} onChange={handleInputChange}>
                                                <option value="">Select Gender</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                            {errors.gender && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.gender}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Date of Birth *</label>
                                            <input type="date" name="dob" max={maxDateString}
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.dob ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.dob} onChange={handleInputChange} />
                                            {errors.dob && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.dob}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Phone Number *</label>
                                            <input type="tel" name="phone"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.phone ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.phone} onChange={handleInputChange}
                                                maxLength={10}
                                            />
                                            {errors.phone && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.phone}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Marital Status *</label>
                                            <select name="marital_status"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.marital_status ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.marital_status} onChange={handleInputChange}>
                                                <option value="">Select Status</option>
                                                <option value="Single">Single</option>
                                                <option value="Married">Married</option>
                                                <option value="Divorced">Divorced</option>
                                                <option value="Widowed">Widowed</option>
                                            </select>
                                            {errors.marital_status && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.marital_status}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">WhatsApp Enabled</label>
                                            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-gray-200 rounded-xl">
                                                <input
                                                    type="checkbox"
                                                    id="whatsapp_enabled"
                                                    name="whatsapp_enabled"
                                                    checked={formData.whatsapp_enabled}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_enabled: e.target.checked }))}
                                                    className="w-4 h-4 text-slate-900 rounded border-gray-300 focus:ring-slate-900"
                                                />
                                                <label htmlFor="whatsapp_enabled" className="text-sm font-medium text-slate-700 cursor-pointer">Receive notifications on WhatsApp</label>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Specially Abled</label>
                                            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-gray-200 rounded-xl">
                                                <input
                                                    type="checkbox"
                                                    id="is_specially_abled"
                                                    name="is_specially_abled"
                                                    checked={formData.is_specially_abled}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, is_specially_abled: e.target.checked }))}
                                                    className="w-4 h-4 text-slate-900 rounded border-gray-300 focus:ring-slate-900"
                                                />
                                                <label htmlFor="is_specially_abled" className="text-sm font-medium text-slate-700 cursor-pointer">Employee is specially abled (PwD)</label>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Card 2: Employment */}
                                <section id="employment" className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm scroll-mt-24 space-y-6">
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 border-b border-slate-100 pb-4">Employment</h2>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Joining Date *</label>
                                            <input type="date" name="joining_date"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.joining_date ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.joining_date} onChange={handleInputChange}
                                            />
                                            {errors.joining_date && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.joining_date}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Department *</label>
                                            <select name="department"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.department ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.department} onChange={handleInputChange}
                                            >
                                                <option value="">Select Dept</option>
                                                <option value="HR">HR</option>
                                                <option value="Engineering">Engineering</option>
                                                <option value="Sales">Sales</option>
                                                <option value="Marketing">Marketing</option>
                                                <option value="Finance">Finance</option>
                                                <option value="Operations">Operations</option>
                                            </select>
                                            {errors.department && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.department}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Designation *</label>
                                            <input type="text" name="designation"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.designation ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.designation} onChange={handleInputChange}
                                            />
                                            {errors.designation && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.designation}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Reporting Person</label>
                                            <input type="text" name="reporting_person"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.reporting_person} onChange={handleInputChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Role *</label>
                                            <select name="role"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.role} onChange={handleInputChange}
                                            >
                                                <option value="employee">Employee</option>
                                                <option value="HR">HR</option>
                                                <option value="admin">Admin</option>
                                                <option value="manager">Manager</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Employment Type *</label>
                                            <select name="employment_type"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.employment_type} onChange={handleInputChange}
                                            >
                                                <option value="permanent">Permanent</option>
                                                <option value="contract">Contract</option>
                                                <option value="consultant">Consultant</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Work Location</label>
                                            <input type="text" name="work_location" placeholder="e.g. Mumbai HQ, Remote"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.work_location} onChange={handleInputChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Job Grade</label>
                                            <select name="job_grade"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.job_grade ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.job_grade} onChange={handleInputChange}
                                                disabled={loadingJobGrades}
                                            >
                                                <option value="">{loadingJobGrades ? 'Loading grades...' : 'Select Job Grade'}</option>
                                                {jobGrades.map((grade) => (
                                                    <option key={grade.id || grade.grade_code} value={grade.grade_code}>
                                                        {grade.name || grade.grade_code} ({Number(grade.min_salary).toLocaleString('en-IN')} - {Number(grade.max_salary).toLocaleString('en-IN')})
                                                    </option>
                                                ))}
                                            </select>
                                            {selectedJobGrade && (
                                                <p className="text-[10px] font-bold uppercase mt-1 text-slate-500">
                                                    Salary band: Rs {Number(selectedJobGrade.min_salary).toLocaleString('en-IN')} - Rs {Number(selectedJobGrade.max_salary).toLocaleString('en-IN')}
                                                </p>
                                            )}
                                            {errors.job_grade && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.job_grade}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Notice Period (Days)</label>
                                            <input type="number" name="notice_period_days" placeholder="e.g. 30"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.notice_period_days} onChange={handleInputChange}
                                                min="0"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Biometric ID</label>
                                            <input type="text" name="biometric_id"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.biometric_id} onChange={handleInputChange}
                                            />
                                        </div>

                                        <div className="md:col-span-2 flex items-center gap-4 my-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Probation Details</span>
                                            <div className="h-px bg-slate-100 w-full"></div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Probation Period</label>
                                            <input type="text" name="probation_period" placeholder="e.g. 6 months"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.probation_period} onChange={handleInputChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Probation Status</label>
                                            <select name="probation_status"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.probation_status} onChange={handleInputChange}
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="confirmed">Confirmed</option>
                                                <option value="extended">Extended</option>
                                            </select>
                                        </div>

                                        {(formData.probation_status === 'pending' || formData.probation_status === 'extended') && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Probation End Date</label>
                                                <input type="date" name="probation_end_date"
                                                    className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                    value={formData.probation_end_date} onChange={handleInputChange}
                                                />
                                            </div>
                                        )}

                                        {(formData.employment_type === 'contract' || formData.employment_type === 'consultant') && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Contract Type</label>
                                                    <select name="contract_type"
                                                        className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                        value={formData.contract_type} onChange={handleInputChange}
                                                    >
                                                        <option value="Contract">Contract</option>
                                                        <option value="Intern">Intern</option>
                                                        <option value="Consultant">Consultant</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Contract End Date</label>
                                                    <input type="date" name="contract_end_date"
                                                        className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                        value={formData.contract_end_date} onChange={handleInputChange}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </section>

                                {/* Card 3: Salary & Finance */}
                                <section id="salary-finance" className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm scroll-mt-24 space-y-6">
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 border-b border-slate-100 pb-4">Salary & Finance</h2>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Salary *</label>
                                            <input type="number" name="salary"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.salary ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.salary} onChange={handleInputChange}
                                            />
                                            {errors.salary && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.salary}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">PAN Number</label>
                                            <input type="text" name="pan_number"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.pan_number ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.pan_number} onChange={handleInputChange}
                                                placeholder="ABCDE1234F"
                                                maxLength={10}
                                            />
                                            {errors.pan_number && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.pan_number}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Aadhaar Number</label>
                                            <input type="text" name="aadhaar_number"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.aadhaar_number ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.aadhaar_number} onChange={handleInputChange}
                                                placeholder="12 digit number"
                                                maxLength={12}
                                            />
                                            {errors.aadhaar_number && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.aadhaar_number}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">UAN Number</label>
                                            <input type="text" name="uan_number"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.uan_number} onChange={handleInputChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">ESI Number</label>
                                            <input type="text" name="esi_number"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.esi_number} onChange={handleInputChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">ESIC Number</label>
                                            <input type="text" name="esic_number"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.esic_number} onChange={handleInputChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">EPF Member ID</label>
                                            <input type="text" name="epf_member_id"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.epf_member_id} onChange={handleInputChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">ESIC IP No.</label>
                                            <input type="text" name="esic_ip_no"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.esic_ip_no} onChange={handleInputChange}
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Hold Payroll</label>
                                            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                                <input
                                                    type="checkbox"
                                                    id="hold_payroll"
                                                    name="hold_payroll"
                                                    checked={formData.hold_payroll}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, hold_payroll: e.target.checked }))}
                                                    className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                                                />
                                                <label htmlFor="hold_payroll" className="text-sm font-medium text-amber-800 cursor-pointer">⚠️ Hold this employee's payroll processing</label>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Status</label>
                                            <select name="status"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.status} onChange={handleInputChange}
                                            >
                                                <option value="active">Active</option>
                                                <option value="on_leave">On Leave</option>
                                                <option value="terminated">Terminated</option>
                                                <option value="resigned">Resigned</option>
                                            </select>
                                        </div>

                                        <div className="md:col-span-2 flex items-center gap-4 my-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Bank Details</span>
                                            <div className="h-px bg-slate-100 w-full"></div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Bank Name</label>
                                            <input type="text" name="bank_name"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.bank_name} onChange={handleInputChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Account No.</label>
                                            <input type="text" name="bank_account_number"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.bank_account_number} onChange={handleInputChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">IFSC Code</label>
                                            <input type="text" name="ifsc_code"
                                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                                                value={formData.ifsc_code} onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>
                                </section>

                                {/* Card 4: Address & Documents */}
                                <section id="address-documents" className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm scroll-mt-24 space-y-6">
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 border-b border-slate-100 pb-4">Address & Documents</h2>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Emergency Contact</label>
                                            <input type="text" name="emergency_contact_person" placeholder="Name"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.emergency_contact_person ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.emergency_contact_person} onChange={handleInputChange}
                                            />
                                            {errors.emergency_contact_person && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.emergency_contact_person}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Emergency Phone</label>
                                            <input type="tel" name="emergency_contact_number" placeholder="Phone"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 ${errors.emergency_contact_number ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.emergency_contact_number} onChange={handleInputChange}
                                                maxLength={10}
                                            />
                                            {errors.emergency_contact_number && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.emergency_contact_number}</p>}
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Current Address *</label>
                                            <textarea name="current_address" rows="2"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 resize-none ${errors.current_address ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} transition-all`}
                                                value={formData.current_address} onChange={handleInputChange}
                                            ></textarea>
                                            {errors.current_address && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.current_address}</p>}
                                        </div>

                                        <div className="md:col-span-2 mb-2">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={sameAddress}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked
                                                        setSameAddress(isChecked)
                                                        if (isChecked) {
                                                            setFormData(prev => ({ ...prev, permanent_address: prev.current_address }))
                                                            const error = validateField('permanent_address', formData.current_address)
                                                            setErrors(prev => {
                                                                const newErrs = { ...prev }
                                                                if (error) newErrs.permanent_address = error
                                                                else delete newErrs.permanent_address
                                                                return newErrs
                                                            })
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-slate-900 rounded focus:ring-slate-900 border-gray-300"
                                                />
                                                <span className="text-sm font-medium text-slate-600">Permanent Address same as Current Address</span>
                                            </label>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Permanent Address *</label>
                                            <textarea name="permanent_address" rows="2"
                                                className={`block w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 resize-none ${errors.permanent_address ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent'} ${sameAddress ? 'opacity-60 bg-slate-100' : ''}`}
                                                value={formData.permanent_address} onChange={handleInputChange}
                                                readOnly={sameAddress}
                                            ></textarea>
                                            {errors.permanent_address && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.permanent_address}</p>}
                                        </div>

                                        <div className="md:col-span-2">
                                             <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">State / Union Territory</label>
                                             <SearchableSelect
                                                 name="state"
                                                 value={formData.state}
                                                 onChange={handleInputChange}
                                                 options={STATE_OPTIONS}
                                                 placeholder="Select State / UT"
                                                 error={!!errors.state}
                                             />
                                             {errors.state && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.state}</p>}
                                         </div>

                                        <div className="md:col-span-2 flex items-center gap-4 my-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Documents</span>
                                            <div className="h-px bg-slate-100 w-full"></div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">ID Proof <span className="text-slate-400 font-normal">(Optional)</span></label>
                                            <input type="file"
                                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                                                onChange={(e) => setFormData({ ...formData, id_proof_url: e.target.files[0]?.name || '' })}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Address Proof <span className="text-slate-400 font-normal">(Optional)</span></label>
                                            <input type="file"
                                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                                                onChange={(e) => setFormData({ ...formData, address_proof_url: e.target.files[0]?.name || '' })}
                                            />
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Standard Table Dashboard View */
                <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <div></div>
                            <div className="flex w-full sm:w-auto gap-4">
                                <div className="relative flex-1 sm:w-64">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                                    <input
                                        type="text"
                                        placeholder="Search employees..."
                                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-blue-500 focus:border-blue-500"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={startAddingEmployee}
                                    className="flex items-center space-x-2 bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition shadow-sm font-bold text-sm"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Add Employee</span>
                                </button>
                                {isAdmin && (
                                    <button
                                        onClick={openBulkImport}
                                        className="flex items-center space-x-2 border border-gray-300 bg-white text-gray-700 px-6 py-2 rounded-lg hover:bg-slate-50 transition shadow-sm font-bold text-sm"
                                    >
                                        <Upload className="h-4 w-4 text-indigo-600 animate-pulse" />
                                        <span>Import CSV</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                            {isAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <>
                                                <EmployeeRowSkeleton />
                                                <EmployeeRowSkeleton />
                                                <EmployeeRowSkeleton />
                                                <EmployeeRowSkeleton />
                                                <EmployeeRowSkeleton />
                                            </>
                                        ) : filteredEmployees.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="text-center py-12">
                                                    <div className="flex flex-col items-center">
                                                        <Users className="w-12 h-12 text-gray-300 mb-3" />
                                                        <p className="text-gray-500 font-medium">No employees found</p>
                                                        <p className="text-gray-400 text-sm">Try adjusting your search criteria</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            currentEmployees.map((emp) => (
                                                <tr key={emp.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{emp.employee_id}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="h-10 w-10 shrink-0">
                                                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                                                    {emp.profile_photo_url ? (
                                                                        <img src={emp.profile_photo_url} alt={`${emp.first_name} ${emp.last_name}`} className="h-10 w-10 rounded-full object-cover" />
                                                                    ) : (
                                                                        <>{emp.first_name?.[0]}{emp.last_name?.[0]}</>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="ml-4">
                                                                <div className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</div>
                                                                <div className="text-sm text-gray-500">{emp.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        <div className="flex flex-col gap-1">
                                                            <span>{emp.designation}</span>
                                                            {(() => {
                                                                const probation = getProbationInfo(emp)

                                                                if (!emp.probation_period || !emp.joining_date || probation.months === 0 || emp.probation_status === 'confirmed') return null;

                                                                if (!probation.active) {
                                                                    return <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">Confirmed</span>;
                                                                }

                                                                if (probation.daysLeft <= 30) {
                                                                    return <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 animate-pulse">Probation ends in {probation.daysLeft} days</span>;
                                                                }

                                                                return <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">On Probation ({probation.daysLeft} days left)</span>;
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.department}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.phone}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${emp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                            {emp.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.joining_date}</td>
                                                    {isAdmin && (
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button
                                                                onClick={() => startEditing(emp)}
                                                                className="text-blue-600 hover:text-blue-900 mr-4"
                                                                title="Edit"
                                                                aria-label="Edit employee"
                                                            >
                                                                <Edit className="h-4 w-4 inline" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClick(emp)}
                                                                className="text-red-600 hover:text-red-900 mr-4"
                                                                title="Delete"
                                                                aria-label="Delete employee"
                                                            >
                                                                <Trash2 className="h-4 w-4 inline" />
                                                            </button>
                                                            <button
                                                                onClick={() => toggleStatus(emp)}
                                                                className={`${emp.status === 'active' ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}`}
                                                                title={emp.status === 'active' ? 'Mark Inactive' : 'Mark Active'}
                                                            >
                                                                {emp.status === 'active' ? 'Deactivate' : 'Activate'}
                                                            </button>
                                                            {isProbationActionable(emp) && (
                                                                <div className="mt-3 flex justify-end gap-3">
                                                                    <button
                                                                        onClick={() => openExtendProbation(emp)}
                                                                        className="text-amber-600 hover:text-amber-900"
                                                                        title="Extend Probation"
                                                                        disabled={probationActionLoading}
                                                                    >
                                                                        Extend Probation
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleConfirmEmployee(emp)}
                                                                        className="text-emerald-600 hover:text-emerald-900"
                                                                        title="Confirm Employee"
                                                                        disabled={probationActionLoading}
                                                                    >
                                                                        Confirm Employee
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {filteredEmployees.length > 0 && (
                                <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
                                    <div className="text-sm text-gray-500">
                                        Showing <span className="font-medium">{indexOfFirstEmployee + 1}</span> to <span className="font-medium">{Math.min(indexOfLastEmployee, filteredEmployees.length)}</span> of <span className="font-medium">{filteredEmployees.length}</span> results
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            aria-label="Previous page"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                                                    currentPage === page
                                                        ? 'bg-slate-900 text-white'
                                                        : 'border border-gray-300 hover:bg-gray-50'
                                                }`}
                                                aria-label={`Page ${page}`}
                                                aria-current={currentPage === page ? 'page' : undefined}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            aria-label="Next page"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Auxiliary Shared Modals */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false)
                    setEmployeeToDelete(null)
                }}
                title="Confirm Delete"
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setShowDeleteModal(false)
                                setEmployeeToDelete(null)
                            }}
                            className="px-6 py-3 bg-slate-100 text-gray-700 rounded-lg font-bold hover:bg-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                }
            >
                <div className="py-4">
                    <p className="text-gray-700">
                        Are you sure you want to delete employee <span className="font-bold">{employeeToDelete?.first_name} {employeeToDelete?.last_name}</span>?
                    </p>
                    <p className="text-gray-500 text-sm mt-2">This action cannot be undone.</p>
                </div>
            </Modal>

            <Modal
                isOpen={showExtendModal}
                onClose={() => {
                    setShowExtendModal(false)
                    setEmployeeForProbation(null)
                }}
                title="Extend Probation"
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setShowExtendModal(false)
                                setEmployeeForProbation(null)
                            }}
                            className="px-6 py-3 bg-slate-100 text-gray-700 rounded-lg font-bold hover:bg-slate-200 transition-colors"
                            disabled={probationActionLoading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleExtendProbation}
                            className="px-6 py-3 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition-colors disabled:opacity-60"
                            disabled={probationActionLoading}
                        >
                            {probationActionLoading ? 'Extending...' : 'Extend & Download Letter'}
                        </button>
                    </div>
                }
            >
                <div className="py-4 space-y-4">
                    <p className="text-sm text-gray-600">
                        Extend probation for <span className="font-bold text-gray-900">{employeeForProbation?.first_name} {employeeForProbation?.last_name}</span>.
                    </p>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Extension Months</label>
                        <input
                            type="number"
                            min="1"
                            name="extension_months"
                            className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                            value={extensionMonths}
                            onChange={(event) => setExtensionMonths(event.target.value)}
                        />
                    </div>
                    <p className="text-xs text-gray-500">
                        The employee record will be updated and a probation extension PDF will download automatically.
                    </p>
                </div>
            </Modal>

            <BulkImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportSuccess={fetchEmployees}
            />
        </div>
    )
}
