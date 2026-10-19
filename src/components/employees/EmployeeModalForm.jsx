import { Loader2, Camera, ArrowLeft } from 'lucide-react'
import SearchableSelect from '../ui/SearchableSelect'

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

export default function EmployeeModalForm({
    editingEmployee,
    formData,
    setFormData,
    errors,
    formSubmitting,
    activeSection,
    scrollToSection,
    navigationPills,
    profilePhotoPreview,
    handleProfilePhotoChange,
    handleRemoveProfilePhoto,
    handleInputChange,
    handleSubmit,
    setIsModalOpen,
    setEditingEmployee,
    setProfilePhotoFile,
    setProfilePhotoPreview,
    setRemoveProfilePhoto,
    maxDateString,
    loadingJobGrades,
    jobGrades,
    selectedJobGrade,
    sameAddress,
    setSameAddress,
    validateField,
    setErrors
}) {
    return (
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
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-900 cursor-pointer"
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
                        className="text-slate-500 hover:text-slate-900 px-4 py-2.5 font-bold text-sm transition-all rounded-xl hover:bg-slate-100 cursor-pointer"
                    >
                        Discard
                    </button>
                    <button
                        type="button"
                        onClick={(e) => handleSubmit(e, 'inactive')}
                        disabled={formSubmitting}
                        className="border border-gray-300 bg-white text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        Save as Draft
                    </button>
                    <button
                        type="button"
                        onClick={(e) => handleSubmit(e, 'active')}
                        disabled={formSubmitting}
                        className="bg-black text-white hover:bg-slate-800 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                        {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
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
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold text-left cursor-pointer ${
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
                                            <label className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 cursor-pointer transition-colors shadow-sm">
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
                                                className="text-sm font-bold text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
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
                                        value={formData.employee_id} onChange={handleInputChange}
                                        placeholder="e.g. EMP003"
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
                                            className="w-4 h-4 text-slate-900 rounded border-gray-300 focus:ring-slate-900 cursor-pointer"
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
                                            className="w-4 h-4 text-slate-900 rounded border-gray-300 focus:ring-slate-900 cursor-pointer"
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
                                            className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
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
                                            className="w-4 h-4 text-slate-900 rounded focus:ring-slate-900 border-gray-300 cursor-pointer"
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
    )
}
