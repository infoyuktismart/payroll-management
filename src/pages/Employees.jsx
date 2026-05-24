import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { devLog } from '../lib/devLogger'
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, Users, Camera, Upload } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { EmployeeRowSkeleton } from '../components/ui/SkeletonLoader'
import BulkImportModal from '../components/BulkImportModal'

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
    const employeesPerPage = 10
    const { isAdmin } = useAuth()
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
        department: '',
        reporting_person: '',
        salary: '',
        role: 'employee',
        pan_number: '',
        aadhaar_number: '',
        bank_name: '',
        bank_account_number: '',
        ifsc_code: '',
        probation_period: '',
        uan_number: '',
        esi_number: '',
        profile_photo_url: '',
        id_proof_url: '',
        address_proof_url: '',
        status: 'active'
    })

    useEffect(() => {
        fetchEmployees()
    }, [])

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

            const { data, error } = await supabase
                .from('employees')
                .select('employee_id')
                .ilike('employee_id', `${prefix}%`)

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

        const fetchEmployees = async () => {
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .order('created_at', { ascending: false })

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
            joining_date: employee.joining_date,
            phone: employee.phone || '',
            emergency_contact_person: employee.emergency_contact_person || '',
            emergency_contact_number: employee.emergency_contact_number || '',
            designation: employee.designation || '',
            current_address: employee.current_address || '',
            permanent_address: employee.permanent_address || '',
            department: employee.department,
            reporting_person: employee.reporting_person || '',
            salary: employee.salary || '',
            role: employee.role || 'employee',
            pan_number: employee.pan_number || '',
            aadhaar_number: employee.aadhaar_number || '',
            bank_name: employee.bank_name || '',
            bank_account_number: employee.bank_account_number || '',
            ifsc_code: employee.ifsc_code || '',
            probation_period: employee.probation_period || '',
            uan_number: employee.uan_number || '',
            esi_number: employee.esi_number || '',
            profile_photo_url: employee.profile_photo_url || '',
            status: employee.status || 'active'
        })
        setProfilePhotoPreview(employee.profile_photo_url || '')
        setProfilePhotoFile(null)
        setRemoveProfilePhoto(false)
        setErrors({})
        setIsModalOpen(true)
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

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setSuccessMessage('') // Use setSuccessMessage as it's already defined

        devLog('Attempting to submit form...')

        // Re-run validation for all fields on submit
        const newErrors = {}
        devLog('Validating form data:', formData)
        Object.keys(formData).forEach(key => {
            const error = validateField(key, formData[key])
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
            const payload = { ...formData }
            if (removeProfilePhoto) {
                payload.profile_photo_url = ''
            }
            if (profilePhotoFile) {
                const safeName = profilePhotoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
                const targetId = editingEmployee?.id || formData.employee_id || `new_${Date.now()}`
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
                devLog('Sending data to Supabase:', payload)
                const { error } = await supabase
                    .from('employees')
                    .insert([payload])
                if (error) throw error
                setSuccessMessage('Employee added successfully!')
            }

            setIsModalOpen(false)
            setEditingEmployee(null)
            fetchEmployees()
            setFormData({
                employee_id: '', first_name: '', last_name: '', email: '', gender: '',
                dob: '', joining_date: '', phone: '', emergency_contact_person: '',
                emergency_contact_number: '', designation: '', current_address: '',
                permanent_address: '', marital_status: '', department: '',
                reporting_person: '', salary: '', role: 'employee',
                pan_number: '', aadhaar_number: '', bank_name: '',
                bank_account_number: '', ifsc_code: '', probation_period: '',
                uan_number: '', esi_number: '', profile_photo_url: '', id_proof_url: '',
                address_proof_url: '', status: 'active'
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

    const validateField = (name, value) => {
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
                if (!value || parseFloat(value) <= 0) error = 'Salary must be a positive number'
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

        setFormData(prev => {
            const newData = { ...prev, [name]: value }

            // Sync addresses if checkbox is checked
            if (name === 'current_address' && sameAddress) {
                newData.permanent_address = value
            }
            return newData
        })

        // Real-time validation
        const fieldError = validateField(name, value)
        setErrors(prev => {
            const newErrors = { ...prev, [name]: fieldError }
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

    return (
        <div className="space-y-6">
            {successMessage && (
                <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-4">
                    {successMessage}
                </div>
            )}

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div></div>
                {/* ... existing search and add button ... */}
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
                        onClick={() => {
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
                                department: '',
                                reporting_person: '',
                                salary: '',
                                role: 'employee',
                                pan_number: '',
                                aadhaar_number: '',
                                bank_name: '',
                                bank_account_number: '',
                                ifsc_code: '',
                                probation_period: '',
                                uan_number: '',
                                esi_number: '',
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
                        }}
                        className="flex items-center space-x-2 bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition shadow-sm font-bold text-sm"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Add Employee</span>
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setIsImportModalOpen(true)}
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
                                                    if (!emp.probation_period || !emp.joining_date || emp.probation_period === '0') return null;
                                                    
                                                    const joiningDate = new Date(emp.joining_date);
                                                    const probationMonths = parseInt(emp.probation_period, 10);
                                                    const probationEndDate = new Date(joiningDate.setMonth(joiningDate.getMonth() + probationMonths));
                                                    const today = new Date();
                                                    
                                                    if (today > probationEndDate) {
                                                        return <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">Confirmed</span>;
                                                    }
                                                    
                                                    const daysLeft = Math.ceil((probationEndDate - today) / (1000 * 60 * 60 * 24));
                                                    if (daysLeft <= 30) {
                                                        return <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 animate-pulse">Probation ends in {daysLeft} days</span>;
                                                    }
                                                    
                                                    return <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">On Probation ({daysLeft} days left)</span>;
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
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    setEditingEmployee(null)
                    setProfilePhotoFile(null)
                    setProfilePhotoPreview('')
                    setRemoveProfilePhoto(false)
                }}
                title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                footer={
                    <div className="flex flex-col w-full gap-4">
                        {errors.submit && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                                <span className="block sm:inline font-bold uppercase text-xs">{errors.submit}</span>
                            </div>
                        )}

                        {Object.keys(errors).length > 0 && !errors.submit && (
                            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-lg relative" role="alert">
                                <span className="block sm:inline font-bold uppercase text-[10px]">Please fix the highlighted errors before submitting.</span>
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsModalOpen(false)
                                    setEditingEmployee(null)
                                    setProfilePhotoFile(null)
                                    setProfilePhotoPreview('')
                                    setRemoveProfilePhoto(false)
                                }}
                                className="px-8 py-3 bg-slate-50 text-gray-600 rounded-lg text-sm font-bold hover:bg-slate-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className={`px-10 py-3 rounded-lg shadow-sm text-sm font-bold transition-all active:scale-95 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-black text-white hover:bg-gray-800'}`}
                            >
                                {loading ? (editingEmployee ? 'Updating...' : 'Adding...') : (editingEmployee ? 'Update Employee' : 'Add Employee')}
                            </button>
                        </div>
                    </div>
                }
            >
                <div className="modal-grid">
                    <div className="full-width rounded-xl border border-gray-200 bg-gray-50 px-5 py-5 mb-2">
                        <div className="flex items-center gap-5">
                            <div className="relative w-24 h-24 rounded-full bg-amber-100 border border-amber-200 overflow-hidden flex items-center justify-center text-2xl font-bold text-slate-700 shrink-0">
                                {profilePhotoPreview ? (
                                    <img src={profilePhotoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                                ) : (
                                    <>{formData.first_name?.[0] || ''}{formData.last_name?.[0] || ''}</>
                                )}
                                <span className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-blue-600 text-white border-2 border-white shadow-md flex items-center justify-center">
                                    <Camera className="w-4 h-4" />
                                </span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-3xl font-bold text-slate-800">Profile Picture</p>
                                <p className="text-base text-gray-500 mt-1">JPG, GIF or PNG. Max size of 2MB.</p>
                                <div className="mt-4 flex items-center gap-5">
                                    <label className="inline-flex items-center px-5 py-2.5 rounded-xl bg-blue-100 text-blue-700 text-base font-bold hover:bg-blue-200 cursor-pointer transition-colors">
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
                                        className="text-base font-bold text-slate-500 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                        disabled={!profilePhotoPreview && !formData.profile_photo_url}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 1: Personal Information */}
                    <div className="full-width flex items-center gap-4 mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Personal Information</span>
                        <div className="h-px bg-slate-100 w-full"></div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Employee ID *</label>
                        <input type="text" name="employee_id"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.employee_id ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.employee_id} readOnly
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Email Address *</label>
                        <input type="email" name="email"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.email ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.email} onChange={handleInputChange}
                        />
                        {errors.email && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.email}</p>}
                    </div>

                    <div className="full-width">
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Full Name *</label>
                        <div className="grid grid-cols-2 gap-3">
                            <input type="text" name="first_name" placeholder="First Name"
                                className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.first_name ? 'border-red-500' : 'border-gray-100'}`}
                                value={formData.first_name} onChange={handleInputChange}
                            />
                            <input type="text" name="last_name" placeholder="Last Name"
                                className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.last_name ? 'border-red-500' : 'border-gray-100'}`}
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
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Gender *</label>
                        <select name="gender"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.gender ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.gender} onChange={handleInputChange}>
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                        {errors.gender && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.gender}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Date of Birth *</label>
                        <input type="date" name="dob" max={maxDateString}
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.dob ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.dob} onChange={handleInputChange} />
                        {errors.dob && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.dob}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Phone Number *</label>
                        <input type="tel" name="phone"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.phone ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.phone} onChange={handleInputChange}
                            maxLength={10}
                        />
                        {errors.phone && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.phone}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Marital Status *</label>
                        <select name="marital_status"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.marital_status ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.marital_status} onChange={handleInputChange}>
                            <option value="">Select Status</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Divorced">Divorced</option>
                            <option value="Widowed">Widowed</option>
                        </select>
                        {errors.marital_status && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.marital_status}</p>}
                    </div>

                    {/* Section 2: Employment Details */}
                    <div className="full-width flex items-center gap-4 mb-2 mt-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Employment Details</span>
                        <div className="h-px bg-slate-100 w-full"></div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Joining Date *</label>
                        <input type="date" name="joining_date"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.joining_date ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.joining_date} onChange={handleInputChange}
                        />
                        {errors.joining_date && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.joining_date}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Department *</label>
                        <select name="department"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.department ? 'border-red-500' : 'border-gray-100'}`}
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
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Designation *</label>
                        <input type="text" name="designation"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.designation ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.designation} onChange={handleInputChange}
                        />
                        {errors.designation && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.designation}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Reporting Person</label>
                        <input type="text" name="reporting_person"
                            className="block w-full border border-gray-100 rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700"
                            value={formData.reporting_person} onChange={handleInputChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Role *</label>
                        <select name="role"
                            className="block w-full border border-gray-100 rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700"
                            value={formData.role} onChange={handleInputChange}
                        >
                            <option value="employee">Employee</option>
                            <option value="HR">HR</option>
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Probation Period</label>
                        <input type="text" name="probation_period" placeholder="e.g. 6 months"
                            className="block w-full border border-gray-100 rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700"
                            value={formData.probation_period} onChange={handleInputChange}
                        />
                    </div>

                    {/* Section 3: Statutory & Financial */}
                    <div className="full-width flex items-center gap-4 mb-2 mt-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Statutory & Financial</span>
                        <div className="h-px bg-slate-100 w-full"></div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Salary *</label>
                        <input type="number" name="salary"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.salary ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.salary} onChange={handleInputChange}
                        />
                        {errors.salary && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.salary}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">PAN Number</label>
                        <input type="text" name="pan_number"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.pan_number ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.pan_number} onChange={handleInputChange}
                            placeholder="ABCDE1234F"
                            maxLength={10}
                        />
                        {errors.pan_number && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.pan_number}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Aadhaar Number</label>
                        <input type="text" name="aadhaar_number"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.aadhaar_number ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.aadhaar_number} onChange={handleInputChange}
                            placeholder="12 digit number"
                            maxLength={12}
                        />
                        {errors.aadhaar_number && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.aadhaar_number}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">UAN Number</label>
                        <input type="text" name="uan_number"
                            className="block w-full border border-gray-100 rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700"
                            value={formData.uan_number} onChange={handleInputChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">ESI Number</label>
                        <input type="text" name="esi_number"
                            className="block w-full border border-gray-100 rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700"
                            value={formData.esi_number} onChange={handleInputChange}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Status</label>
                        <select name="status"
                            className="block w-full border border-gray-100 rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700"
                            value={formData.status} onChange={handleInputChange}
                        >
                            <option value="active">Active</option>
                            <option value="on_leave">On Leave</option>
                            <option value="terminated">Terminated</option>
                            <option value="resigned">Resigned</option>
                        </select>
                    </div>

                    {/* Section 4: Bank Details */}
                    <div className="full-width flex items-center gap-4 mb-2 mt-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Bank Details</span>
                        <div className="h-px bg-slate-100 w-full"></div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Bank Name</label>
                        <input type="text" name="bank_name"
                            className="block w-full border border-gray-100 rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700"
                            value={formData.bank_name} onChange={handleInputChange}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Account No.</label>
                        <input type="text" name="bank_account_number"
                            className="block w-full border border-gray-100 rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700"
                            value={formData.bank_account_number} onChange={handleInputChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">IFSC Code</label>
                        <input type="text" name="ifsc_code"
                            className="block w-full border border-gray-100 rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700"
                            value={formData.ifsc_code} onChange={handleInputChange}
                        />
                    </div>
                    <div>
                        {/* Empty space to maintain grid flow if needed, or just let it wrap */}
                    </div>

                    {/* Section 5: Address & Contact */}
                    <div className="full-width flex items-center gap-4 mb-2 mt-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Address & Contact</span>
                        <div className="h-px bg-slate-100 w-full"></div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Emergency Contact</label>
                        <input type="text" name="emergency_contact_person" placeholder="Name"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.emergency_contact_person ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.emergency_contact_person} onChange={handleInputChange}
                        />
                        {errors.emergency_contact_person && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.emergency_contact_person}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Emergency Phone</label>
                        <input type="tel" name="emergency_contact_number" placeholder="Phone"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 ${errors.emergency_contact_number ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.emergency_contact_number} onChange={handleInputChange}
                            maxLength={10}
                        />
                        {errors.emergency_contact_number && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.emergency_contact_number}</p>}
                    </div>

                    <div className="full-width">
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Current Address *</label>
                        <textarea name="current_address" rows="2"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 resize-none ${errors.current_address ? 'border-red-500' : 'border-gray-100'}`}
                            value={formData.current_address} onChange={handleInputChange}
                        ></textarea>
                        {errors.current_address && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.current_address}</p>}
                    </div>

                    <div className="full-width mb-2">
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
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-600">Permanent Address same as Current Address</span>
                        </label>
                    </div>

                    <div className="full-width">
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Permanent Address *</label>
                        <textarea name="permanent_address" rows="2"
                            className={`block w-full border rounded-lg shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 resize-none ${errors.permanent_address ? 'border-red-500' : 'border-gray-100'} ${sameAddress ? 'opacity-60 bg-gray-100' : ''}`}
                            value={formData.permanent_address} onChange={handleInputChange}
                            readOnly={sameAddress}
                        ></textarea>
                        {errors.permanent_address && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.permanent_address}</p>}
                    </div>

                    {/* Section 6: Documents */}
                    <div className="full-width flex items-center gap-4 mb-2 mt-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Documents</span>
                        <div className="h-px bg-slate-100 w-full"></div>
                    </div>
                    <div className="full-width grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">ID Proof <span className="optional">(Optional)</span></label>
                            <input type="file"
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                                onChange={(e) => setFormData({ ...formData, id_proof_url: e.target.files[0]?.name || '' })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Address Proof <span className="optional">(Optional)</span></label>
                            <input type="file"
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                                onChange={(e) => setFormData({ ...formData, address_proof_url: e.target.files[0]?.name || '' })}
                            />
                        </div>
                    </div>
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
