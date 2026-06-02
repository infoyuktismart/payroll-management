import { useState } from 'react'
import { Camera, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function PortalPersonalTab({
    currentEmployee,
    tenureText,
    totalRemainingPto,
    attendanceStats,
    upcomingLeave,
    formatDateSafe,
    toast,
    onProfileUpdated
}) {
    const [showEditProfileModal, setShowEditProfileModal] = useState(false)
    const [profileSaving, setProfileSaving] = useState(false)
    const [profileForm, setProfileForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        designation: '',
        department: '',
        reporting_person: '',
        marital_status: '',
        current_address: '',
        permanent_address: ''
    })
    const [profilePhotoPreview, setProfilePhotoPreview] = useState(null)
    const [profilePhotoFile, setProfilePhotoFile] = useState(null)

    const openEditModal = () => {
        setProfileForm({
            first_name: currentEmployee.first_name || '',
            last_name: currentEmployee.last_name || '',
            email: currentEmployee.email || '',
            phone: currentEmployee.phone || '',
            designation: currentEmployee.designation || '',
            department: currentEmployee.department || '',
            reporting_person: currentEmployee.reporting_person || '',
            marital_status: currentEmployee.marital_status || '',
            current_address: currentEmployee.current_address || '',
            permanent_address: currentEmployee.permanent_address || ''
        })
        setProfilePhotoPreview(currentEmployee.profile_photo_url || null)
        setProfilePhotoFile(null)
        setShowEditProfileModal(true)
    }

    const handleProfilePhotoChange = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Image size must be less than 2MB.')
            return
        }
        setProfilePhotoFile(file)
        setProfilePhotoPreview(URL.createObjectURL(file))
    }

    const handleRemoveProfilePhoto = () => {
        setProfilePhotoFile(null)
        setProfilePhotoPreview(null)
    }

    const handleSaveProfile = async () => {
        setProfileSaving(true)
        try {
            let photoUrl = currentEmployee.profile_photo_url || null

            // Upload photo if changed
            if (profilePhotoFile) {
                const fileExt = profilePhotoFile.name.split('.').pop()
                const fileName = `${currentEmployee.id}_${Date.now()}.${fileExt}`
                const { error: uploadError } = await supabase.storage
                    .from('employee-photos')
                    .upload(fileName, profilePhotoFile, { cacheControl: '3600', upsert: true })

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('employee-photos')
                    .getPublicUrl(fileName)

                photoUrl = publicUrl
            } else if (profilePhotoPreview === null && currentEmployee.profile_photo_url) {
                // Photo was removed
                photoUrl = null
            }

            const { error } = await supabase
                .from('employees')
                .update({
                    ...profileForm,
                    profile_photo_url: photoUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentEmployee.id)

            if (error) throw error

            toast.success('Profile updated successfully!')
            setShowEditProfileModal(false)
            if (onProfileUpdated) onProfileUpdated()
        } catch (err) {
            toast.error('Error saving profile: ' + err.message)
        } finally {
            setProfileSaving(false)
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                        <h3 className="text-lg font-bold text-slate-800">Contact Details</h3>
                        <button
                            onClick={openEditModal}
                            className="px-4 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 hover:text-blue-600 transition"
                        >
                            Edit Profile
                        </button>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Email Address</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{currentEmployee.email || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Phone Number</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{currentEmployee.phone || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Work Extension</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{currentEmployee.work_extension || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Alternative Email</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{currentEmployee.alternative_email || currentEmployee.email || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                        <h3 className="text-lg font-bold text-slate-800">Home Address</h3>
                    </div>
                    <div className="p-6">
                        <div className="rounded-xl bg-slate-50 border border-slate-100 p-5">
                            <p className="text-sm font-bold text-slate-800">{currentEmployee.current_address || currentEmployee.permanent_address || 'Address not available'}</p>
                            <p className="text-xs text-gray-500 mt-1">{currentEmployee.department || 'Department location not set'}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                        <h3 className="text-lg font-bold text-slate-800">Emergency Contact</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Name</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{currentEmployee.emergency_contact_person || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Relationship</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{currentEmployee.emergency_contact_relationship || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Phone Number</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{currentEmployee.emergency_contact_number || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                        <h3 className="text-lg font-bold text-slate-800">Quick Stats</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/50 border border-blue-100/50">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tenure</span>
                            <span className="text-sm font-black text-slate-800">{tenureText}</span>
                        </div>
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100/50">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remaining PTO</span>
                            <span className="text-sm font-black text-emerald-700">{totalRemainingPto} Days</span>
                        </div>
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/50 border border-amber-100/50">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance Rate</span>
                            <span className="text-sm font-black text-amber-700">{attendanceStats.rate}%</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                        <h3 className="text-lg font-bold text-slate-800">Upcoming Leave</h3>
                    </div>
                    <div className="p-6">
                        {upcomingLeave ? (
                            <div>
                                <p className="text-sm font-bold text-slate-800">{upcomingLeave.leave_type}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {formatDateSafe(upcomingLeave.start_date)} - {formatDateSafe(upcomingLeave.end_date)}
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-600 italic">No upcoming leave scheduled.</p>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                        <h3 className="text-lg font-bold text-slate-800">Direct Manager</h3>
                    </div>
                    <div className="p-6 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-600">M</div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">{currentEmployee.reporting_person || 'Not assigned'}</p>
                            <p className="text-xs text-gray-500">{currentEmployee.department || 'Department'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Profile Modal */}
            {showEditProfileModal && (
                <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-3xl bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-850">Edit Profile</h3>
                            <button onClick={() => setShowEditProfileModal(false)} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="flex items-center gap-4">
                                <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-5 py-5">
                                    <div className="flex items-center gap-5">
                                        <div className="relative w-24 h-24 rounded-full bg-slate-200 border border-gray-200 overflow-hidden flex items-center justify-center text-xl font-bold text-slate-700 shrink-0">
                                            {profilePhotoPreview ? (
                                                <img src={profilePhotoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <>{profileForm.first_name?.[0] || ''}{profileForm.last_name?.[0] || ''}</>
                                            )}
                                            <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 text-white border-2 border-white shadow flex items-center justify-center">
                                                <Camera className="w-4 h-4" />
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-lg font-bold text-slate-800">Profile Picture</p>
                                            <p className="text-xs text-gray-500 mt-0.5">JPG, GIF or PNG. Max size of 2MB.</p>
                                            <div className="mt-3 flex items-center gap-4">
                                                <label className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 cursor-pointer transition-colors">
                                                    Change photo
                                                    <input type="file" accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif" className="hidden" onChange={handleProfilePhotoChange} />
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveProfilePhoto}
                                                    className="text-xs font-bold text-slate-500 hover:text-slate-700"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">First Name</label>
                                    <input className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-sm" value={profileForm.first_name} onChange={(e) => setProfileForm((p) => ({ ...p, first_name: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Last Name</label>
                                    <input className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-sm" value={profileForm.last_name} onChange={(e) => setProfileForm((p) => ({ ...p, last_name: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                    <input className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-sm" value={profileForm.email} onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label>
                                    <input className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-sm" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Marital Status</label>
                                    <input className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-sm" value={profileForm.marital_status} onChange={(e) => setProfileForm((p) => ({ ...p, marital_status: e.target.value }))} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Address</label>
                                    <textarea className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-sm" rows="2" value={profileForm.current_address} onChange={(e) => setProfileForm((p) => ({ ...p, current_address: e.target.value }))} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Permanent Address</label>
                                    <textarea className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-sm" rows="2" value={profileForm.permanent_address} onChange={(e) => setProfileForm((p) => ({ ...p, permanent_address: e.target.value }))} />
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setShowEditProfileModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-100">Cancel</button>
                            <button onClick={handleSaveProfile} disabled={profileSaving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
                                {profileSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
