import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useCompany } from '../context/CompanyContext'
import { usePlanEntitlements } from '../hooks/usePlanEntitlements'
import {
    useAllEmployees,
    useJobGrades,
    useToggleEmployeeStatus,
    useExtendProbation,
    useConfirmEmployee,
    useSaveEmployee,
    useDeleteEmployee
} from '../hooks/useEmployees'
import { employeeService } from '../services/employeeService'
import { User, Briefcase, IndianRupee, MapPin } from 'lucide-react'
import Modal from '../components/ui/Modal'
import BulkImportModal from '../components/BulkImportModal'

// Decomposed Subcomponents
import EmployeeFilterBar from '../components/employees/EmployeeFilterBar'
import EmployeeTable from '../components/employees/EmployeeTable'
import EmployeeModalForm from '../components/employees/EmployeeModalForm'

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
    const queryClient = useQueryClient()
    
    // UI states
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
    const [showExtendModal, setShowExtendModal] = useState(false)
    const [employeeForProbation, setEmployeeForProbation] = useState(null)
    const [extensionMonths, setExtensionMonths] = useState('1')
    const [activeSection, setActiveSection] = useState('basic-info')

    const employeesPerPage = 10
    const { isAdmin } = useAuth()
    const { activeCompanyId } = useCompany()
    const { entitlements, canAddUsage } = usePlanEntitlements()

    // ─── React Query Hooks ───
    const employeesQuery = useAllEmployees()
    const jobGradesQuery = useJobGrades(activeCompanyId)

    const employees = employeesQuery.data || []
    const jobGrades = jobGradesQuery.data || DEFAULT_JOB_GRADES
    const loading = employeesQuery.isLoading
    const loadingJobGrades = jobGradesQuery.isLoading

    const refreshEmployeeManagementData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['employees'] })
        queryClient.invalidateQueries({ queryKey: ['planEntitlements'] })
    }, [queryClient])

    const scrollToSection = (id) => {
        setActiveSection(id)
        const el = document.getElementById(id)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    // Modal scroll observer
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

    const selectedJobGrade = useMemo(() => {
        if (!formData.job_grade) return null
        return jobGrades.find((grade) => grade.grade_code === formData.job_grade || grade.name === formData.job_grade)
    }, [formData.job_grade, jobGrades])

    // Detect navigation state trigger
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
            const nextId = await employeeService.generateNextEmployeeId()
            setFormData(prev => ({ ...prev, employee_id: nextId }))
        } catch (error) {
            console.error('Error generating employee ID:', error)
        }
    }

    // ─── Mutations via Service layer ───
    const toggleStatusMutation = useToggleEmployeeStatus()

    const toggleStatus = (employee) => {
        if (!isAdmin) return
        toggleStatusMutation.mutate(employee)
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

    const extendProbationMutation = useExtendProbation()
    const confirmEmployeeMutation = useConfirmEmployee()

    const probationActionLoading = extendProbationMutation.isPending || confirmEmployeeMutation.isPending

    const handleExtendProbation = async () => {
        if (!employeeForProbation) return
        const extension = parseInt(extensionMonths, 10)
        if (!Number.isFinite(extension) || extension <= 0) {
            toast.error('Enter a valid extension in months.')
            return
        }
        try {
            const result = await extendProbationMutation.mutateAsync({ employee: employeeForProbation, extension })
            await downloadProbationLetter(result.employee, 'extension', { extensionMonths: result.extension, totalMonths: result.totalMonths, endDate: result.endDate })
            toast.success('Probation extended and letter downloaded.')
            setShowExtendModal(false)
            setEmployeeForProbation(null)
            refreshEmployeeManagementData()
        } catch (_) {
            // Handled by hook
        }
    }

    const handleConfirmEmployee = async (employee) => {
        try {
            const result = await confirmEmployeeMutation.mutateAsync(employee)
            await downloadProbationLetter(result, 'confirmation')
            toast.success('Employee confirmed and letter downloaded.')
            refreshEmployeeManagementData()
        } catch (_) {
            // Handled by hook
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

    const saveEmployeeMutation = useSaveEmployee()

    const formSubmitting = saveEmployeeMutation.isPending

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
            if (name === 'current_address' && sameAddress) {
                newData.permanent_address = value
            }
            return newData
        })

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
            if (name === 'current_address' && sameAddress) {
                const permError = validateField('permanent_address', value)
                if (permError) newErrors.permanent_address = permError
                else delete newErrors.permanent_address
            }
            return newErrors
        })
    }

    const handleSubmit = async (e, forcedStatus = null) => {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault()
        }
        setSuccessMessage('')

        const currentData = { ...formData }
        if (forcedStatus) {
            currentData.status = forcedStatus
            setFormData(prev => ({ ...prev, status: forcedStatus }))
        }

        const newErrors = {}
        Object.keys(currentData).forEach(key => {
            const error = validateField(key, currentData[key])
            if (error) {
                newErrors[key] = error
            }
        })
        setErrors(newErrors)
        const isValid = Object.keys(newErrors).length === 0
        if (!isValid) {
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

        try {
            const res = await saveEmployeeMutation.mutateAsync({
                currentData,
                editingEmployee,
                profilePhotoFile,
                removeProfilePhoto,
                canAddUsage,
                entitlements
            })
            const mode = res.mode
            setSuccessMessage(mode === 'updated' ? 'Employee updated successfully!' : 'Employee added successfully!')
            setIsModalOpen(false)
            setEditingEmployee(null)
            refreshEmployeeManagementData()
            setProfilePhotoFile(null)
            setProfilePhotoPreview('')
            setRemoveProfilePhoto(false)
            setErrors({})
            setTimeout(() => setSuccessMessage(''), 3000)
        } catch (error) {
            console.error('Form submission unexpected error:', error)
            setErrors(prev => ({ ...prev, submit: error.message || 'Failed to add/update employee. Please check connection and try again.' }))
        }
    }

    const deleteEmployeeMutation = useDeleteEmployee()

    const confirmDelete = async () => {
        if (!employeeToDelete) return
        try {
            await deleteEmployeeMutation.mutateAsync(employeeToDelete.id)
            refreshEmployeeManagementData()
        } catch (_) {
            // Error is handled by the hook
        } finally {
            setShowDeleteModal(false)
            setEmployeeToDelete(null)
        }
    }

    const handleDeleteClick = (emp) => {
        setEmployeeToDelete(emp)
        setShowDeleteModal(true)
    }

    const filteredEmployees = employees.filter(emp =>
        (emp.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.last_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    )

    const indexOfLastEmployee = currentPage * employeesPerPage
    const indexOfFirstEmployee = indexOfLastEmployee - employeesPerPage
    const currentEmployees = filteredEmployees.slice(indexOfFirstEmployee, indexOfLastEmployee)

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm])

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
                /* Full-Page Takeover Layout Subcomponent */
                <EmployeeModalForm
                    editingEmployee={editingEmployee}
                    formData={formData}
                    setFormData={setFormData}
                    errors={errors}
                    formSubmitting={formSubmitting}
                    activeSection={activeSection}
                    scrollToSection={scrollToSection}
                    navigationPills={navigationPills}
                    profilePhotoPreview={profilePhotoPreview}
                    handleProfilePhotoChange={handleProfilePhotoChange}
                    handleRemoveProfilePhoto={handleRemoveProfilePhoto}
                    handleInputChange={handleInputChange}
                    handleSubmit={handleSubmit}
                    setIsModalOpen={setIsModalOpen}
                    setEditingEmployee={setEditingEmployee}
                    setProfilePhotoFile={setProfilePhotoFile}
                    setProfilePhotoPreview={setProfilePhotoPreview}
                    setRemoveProfilePhoto={setRemoveProfilePhoto}
                    maxDateString={maxDateString}
                    loadingJobGrades={loadingJobGrades}
                    jobGrades={jobGrades}
                    selectedJobGrade={selectedJobGrade}
                    sameAddress={sameAddress}
                    setSameAddress={setSameAddress}
                    validateField={validateField}
                    setErrors={setErrors}
                />
            ) : (
                /* Standard Table Dashboard View */
                <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        {/* Filter Bar Subcomponent */}
                        <EmployeeFilterBar
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            startAddingEmployee={startAddingEmployee}
                            openBulkImport={openBulkImport}
                            isAdmin={isAdmin}
                        />

                        {/* Table Subcomponent */}
                        <EmployeeTable
                            loading={loading}
                            currentEmployees={currentEmployees}
                            filteredEmployees={filteredEmployees}
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            employeesPerPage={employeesPerPage}
                            isAdmin={isAdmin}
                            startEditing={startEditing}
                            handleDeleteClick={handleDeleteClick}
                            toggleStatus={toggleStatus}
                            getProbationInfo={getProbationInfo}
                            isProbationActionable={isProbationActionable}
                            openExtendProbation={openExtendProbation}
                            handleConfirmEmployee={handleConfirmEmployee}
                            probationActionLoading={probationActionLoading}
                        />
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <Modal
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    title="Delete Employee"
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">
                            Are you sure you want to delete <b>{employeeToDelete?.first_name} {employeeToDelete?.last_name}</b>? This action is permanent and cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm transition cursor-pointer"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Extend Probation Modal */}
            {showExtendModal && (
                <Modal
                    isOpen={showExtendModal}
                    onClose={() => setShowExtendModal(false)}
                    title="Extend Probation"
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">
                            Extend probation for <b>{employeeForProbation?.first_name} {employeeForProbation?.last_name}</b>.
                        </p>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Extension (Months)</label>
                            <input
                                type="number"
                                min="1"
                                value={extensionMonths}
                                onChange={(e) => setExtensionMonths(e.target.value)}
                                className="block w-full border border-gray-200 rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:outline-none transition-all"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowExtendModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExtendProbation}
                                disabled={probationActionLoading}
                                className="px-4 py-2 bg-black hover:bg-slate-800 text-white rounded-lg text-sm transition cursor-pointer"
                            >
                                Extend
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            <BulkImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={refreshEmployeeManagementData}
            />
        </div>
    )
}
