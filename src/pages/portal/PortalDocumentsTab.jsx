import { useState, useEffect } from 'react'
import { Upload, FileText, Image as ImageIcon, Eye, Download, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const formatDateSafe = (value, options = { month: 'short', day: '2-digit', year: 'numeric' }, fallback = 'N/A') => {
    if (!value) return fallback
    const d = new Date(value)
    return isNaN(d.getTime()) ? fallback : d.toLocaleDateString('en-US', options)
}

export default function PortalDocumentsTab({
    currentEmployee,
    viewAsId,
    toast
}) {
    const [documentCategory, setDocumentCategory] = useState('tax') // 'tax', 'company', 'personal'
    const [documents, setDocuments] = useState([])
    const [documentsTotal, setDocumentsTotal] = useState(0)
    const [docCurrentPage, setDocCurrentPage] = useState(1)
    const [loading, setLoading] = useState(false) // eslint-disable-line no-unused-vars

    // Upload modal states
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [uploadCategory, setUploadCategory] = useState('')
    const [stagedFiles, setStagedFiles] = useState([])
    const [isDragActive, setIsDragActive] = useState(false)
    const [uploadingDocument, setUploadingDocument] = useState(false)

    // Delete modal state
    const [documentToDelete, setDocumentToDelete] = useState(null)

    const fetchDocumentsPage = async (employeeId, page, section, fallbackEmployee = currentEmployee) => {
        if (!employeeId) return
        const start = (page - 1) * 4
        const end = start + 3
        setLoading(true)
        try {
            const { data, error, count } = await supabase
                .from('employee_documents')
                .select('*', { count: 'exact' })
                .eq('employee_id', employeeId)
                .eq('section', section)
                .order('created_at', { ascending: false })
                .range(start, end)

            if (error) throw error
            setDocuments(data || [])
            setDocumentsTotal(count || 0)
        } catch {
            const fallbackDocs = []
            if (fallbackEmployee?.id_proof_url && section === 'personal') {
                fallbackDocs.push({
                    id: `id-${employeeId}`,
                    file_name: fallbackEmployee.id_proof_url.split('/').pop() || 'ID_Proof',
                    category: 'Identification',
                    section: 'personal',
                    status: 'verified',
                    uploaded_at: fallbackEmployee.updated_at || fallbackEmployee.created_at,
                    file_size_mb: null,
                    file_url: fallbackEmployee.id_proof_url
                })
            }
            if (fallbackEmployee?.address_proof_url && section === 'personal') {
                fallbackDocs.push({
                    id: `address-${employeeId}`,
                    file_name: fallbackEmployee.address_proof_url.split('/').pop() || 'Address_Proof',
                    category: 'Personal Record',
                    section: 'personal',
                    status: 'pending',
                    uploaded_at: fallbackEmployee.updated_at || fallbackEmployee.created_at,
                    file_size_mb: null,
                    file_url: fallbackEmployee.address_proof_url
                })
            }
            setDocuments(fallbackDocs)
            setDocumentsTotal(fallbackDocs.length)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (viewAsId) {
            fetchDocumentsPage(viewAsId, docCurrentPage, documentCategory)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewAsId, docCurrentPage, documentCategory])

    useEffect(() => {
        setDocCurrentPage(1)
    }, [documentCategory, viewAsId])

    const getDefaultCategoryBySection = (section) => {
        const map = {
            tax: 'Tax Form',
            company: 'Company Form',
            personal: 'Personal Record'
        }
        return map[section] || 'Personal Record'
    }

    const handleOpenUploadModal = () => {
        setUploadCategory(getDefaultCategoryBySection(documentCategory))
        setStagedFiles([])
        setShowUploadModal(true)
    }

    const handleStageFiles = (filesList) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png']
        const maxBytes = 10 * 1024 * 1024

        const incoming = Array.from(filesList || [])
        if (incoming.length === 0) return

        const newItems = []
        incoming.forEach((file) => {
            if (!allowedTypes.includes(file.type)) {
                toast.error(`${file.name}: only PDF, JPG, PNG allowed.`)
                return
            }
            if (file.size > maxBytes) {
                toast.error(`${file.name}: file exceeds 10MB limit.`)
                return
            }

            newItems.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                file,
                progress: 0,
                status: 'ready',
                error: ''
            })
        })

        if (newItems.length > 0) {
            setStagedFiles((prev) => [...prev, ...newItems])
        }
    }

    const handleRetryStagedFile = (fileId) => {
        setStagedFiles((prev) => prev.map((file) => (
            file.id === fileId ? { ...file, status: 'ready', progress: 0, error: '' } : file
        )))
    }

    const getFileVisual = (docOrFile) => {
        const mime = (docOrFile?.mime_type || docOrFile?.file?.type || '').toLowerCase()
        const name = (docOrFile?.file_name || docOrFile?.file?.name || '').toLowerCase()
        const isPdf = mime.includes('pdf') || name.endsWith('.pdf')
        const isImage = mime.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/.test(name)

        if (isPdf) {
            return {
                icon: FileText,
                wrapper: 'bg-rose-50 text-rose-600 border border-rose-100',
            }
        }

        if (isImage) {
            return {
                icon: ImageIcon,
                wrapper: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
            }
        }

        return {
            icon: FileText,
            wrapper: 'bg-blue-50 text-blue-600 border border-blue-100',
        }
    }

    const handleUploadDocumentBatch = async () => {
        if (!viewAsId || stagedFiles.length === 0 || !uploadCategory) return
        setUploadingDocument(true)

        const sectionToCategory = {
            tax: 'Tax Form',
            company: 'Company Form',
            personal: 'Personal Record'
        }
        const normalizedCategory = uploadCategory || sectionToCategory[documentCategory]
        const bucketName = 'employee-documents'
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

        let successCount = 0
        const queue = stagedFiles.filter((item) => item.status !== 'completed')
        for (const item of queue) {
            setStagedFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'uploading', progress: 20 } : f))
            await delay(120)
            setStagedFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, progress: 60 } : f))

            try {
                const safeFileName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
                const storagePath = `${viewAsId}/${Date.now()}_${safeFileName}`

                const { error: uploadError } = await supabase
                    .storage
                    .from(bucketName)
                    .upload(storagePath, item.file, {
                        contentType: item.file.type,
                        upsert: false
                    })

                if (uploadError) throw uploadError

                const { data: publicData } = supabase
                    .storage
                    .from(bucketName)
                    .getPublicUrl(storagePath)

                const payload = {
                    employee_id: viewAsId,
                    file_name: item.file.name,
                    category: normalizedCategory,
                    section: documentCategory,
                    status: 'pending',
                    file_size_mb: Number((item.file.size / (1024 * 1024)).toFixed(2)),
                    uploaded_at: new Date().toISOString(),
                    mime_type: item.file.type,
                    storage_path: storagePath,
                    file_url: publicData?.publicUrl || null
                }

                const { error } = await supabase
                    .from('employee_documents')
                    .insert(payload)
                    .select('*')
                    .single()

                if (error) throw error

                successCount += 1
                setStagedFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'completed', progress: 100 } : f))
            } catch (error) {
                setStagedFiles((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'failed', error: error.message || 'Upload failed' } : f))
            }
        }

        setUploadingDocument(false)
        if (successCount > 0) {
            await fetchDocumentsPage(viewAsId, docCurrentPage, documentCategory)
            toast.success(`${successCount} document(s) uploaded successfully.`)
            setTimeout(() => {
                setShowUploadModal(false)
                setStagedFiles([])
            }, 700)
        } else {
            toast.error('No documents were uploaded.')
        }
    }

    const handleDeleteDocument = async () => {
        if (!documentToDelete?.id) return
        try {
            if (documentToDelete.storage_path) {
                await supabase.storage.from('employee-documents').remove([documentToDelete.storage_path])
            }
            const { error } = await supabase
                .from('employee_documents')
                .delete()
                .eq('id', documentToDelete.id)
            if (error) throw error
            await fetchDocumentsPage(viewAsId, docCurrentPage, documentCategory)
            toast.success('Document removed successfully.')
        } catch (error) {
            toast.error(error.message || 'Failed to remove document.')
        } finally {
            setDocumentToDelete(null)
        }
    }

    const handleViewDocument = async (doc) => {
        if (doc.file_url) {
            window.open(doc.file_url, '_blank', 'noopener,noreferrer')
            return
        }
        if (doc.storage_path) {
            const { data, error } = await supabase.storage.from('employee-documents').createSignedUrl(doc.storage_path, 120)
            if (!error && data?.signedUrl) {
                window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
                return
            }
        }
        toast.error('No file URL found for this document.')
    }

    const handleDownloadDocument = async (doc) => {
        let fileUrl = doc.file_url
        if (!fileUrl && doc.storage_path) {
            const { data, error } = await supabase
                .storage
                .from('employee-documents')
                .createSignedUrl(doc.storage_path, 120, { download: doc.file_name || 'document' })
            if (!error && data?.signedUrl) fileUrl = data.signedUrl
        }
        if (!fileUrl) {
            toast.error('No downloadable file found.')
            return
        }
        const link = document.createElement('a')
        link.href = fileUrl
        link.download = doc.file_name || 'document'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const documentsPerPage = 4
    const totalDocumentPages = Math.max(1, Math.ceil((documentsTotal || 0) / documentsPerPage))

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Documents</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Manage official records and employment documents</p>
                </div>
                <button
                    onClick={handleOpenUploadModal}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow"
                >
                    <Upload className="w-4 h-4" /> Upload Document
                </button>
            </div>

            <div className="inline-flex items-center space-x-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                {[
                    { key: 'tax', label: 'Tax Forms' },
                    { key: 'company', label: 'Company Forms' },
                    { key: 'personal', label: 'Personal Records' }
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setDocumentCategory(tab.key)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${documentCategory === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-550 hover:bg-slate-50'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-gray-150">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Document Name</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Upload Date</th>
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {documents.map((doc) => {
                                const status = (doc.status || 'pending').toLowerCase()
                                const statusClass = status === 'verified'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : status === 'expired'
                                        ? 'bg-rose-100 text-rose-700'
                                        : 'bg-amber-100 text-amber-700'
                                const uploadedDate = doc.uploaded_at || doc.created_at

                                return (
                                    <tr key={doc.id} className="hover:bg-slate-50/50 transition">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getFileVisual(doc).wrapper}`}>
                                                    {(() => {
                                                        const Icon = getFileVisual(doc).icon
                                                        return <Icon className="w-5 h-5" />
                                                    })()}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900">{doc.file_name || doc.name || 'Untitled document'}</p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">{doc.file_size_mb ? `${doc.file_size_mb} MB` : 'Size unavailable'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-medium text-gray-700">{doc.category || 'General'}</td>
                                        <td className="px-6 py-4 text-xs font-medium text-gray-700">
                                            {uploadedDate ? formatDateSafe(uploadedDate, { month: 'short', day: '2-digit', year: 'numeric' }) : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusClass}`}>{status}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2.5">
                                                <button onClick={() => handleViewDocument(doc)} className="text-gray-400 hover:text-blue-600 transition" aria-label="View document">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDownloadDocument(doc)} className="text-gray-400 hover:text-blue-600 transition" aria-label="Download document">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setDocumentToDelete(doc)} className="text-gray-400 hover:text-rose-600 transition" aria-label="Delete document">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}

                            {documents.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-14 text-center">
                                        <p className="text-xs text-gray-400 italic">No documents found in this category.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-4 border-t border-gray-150 text-xs text-gray-400 flex items-center justify-between">
                    <span>Showing {documents.length} of {documentsTotal} document(s)</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setDocCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={docCurrentPage === 1}
                            className="px-3 py-1 rounded-lg border border-gray-250 text-[10px] font-bold text-gray-650 disabled:opacity-50 hover:bg-slate-50 transition"
                        >
                            Previous
                        </button>
                        <span className="px-2 py-1 text-xs font-bold text-blue-600">{docCurrentPage}</span>
                        <button
                            onClick={() => setDocCurrentPage((p) => Math.min(totalDocumentPages, p + 1))}
                            disabled={docCurrentPage >= totalDocumentPages}
                            className="px-3 py-1 rounded-lg border border-gray-255 text-[10px] font-bold text-gray-650 disabled:opacity-50 hover:bg-slate-50 transition"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Upload Document Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h2 className="text-base font-bold text-slate-800">Upload Document</h2>
                            <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">Document Category</label>
                                <select
                                    value={uploadCategory}
                                    onChange={(e) => setUploadCategory(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 bg-white"
                                >
                                    <option value="">Select category...</option>
                                    <option value="Tax Form">Tax Form</option>
                                    <option value="Company Form">Company Form</option>
                                    <option value="Personal Record">Personal Record</option>
                                    <option value="Contract">Contract</option>
                                    <option value="Education">Education</option>
                                    <option value="Identification">Identification</option>
                                </select>
                            </div>

                            <div
                                className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${isDragActive ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 bg-slate-50/50'}`}
                                onDragOver={(e) => {
                                    e.preventDefault()
                                    setIsDragActive(true)
                                }}
                                onDragLeave={() => setIsDragActive(false)}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    setIsDragActive(false)
                                    handleStageFiles(e.dataTransfer.files)
                                }}
                            >
                                <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                                    <Upload className="w-5 h-5" />
                                </div>
                                <p className="text-sm font-bold text-slate-800">Click to upload or drag and drop</p>
                                <p className="text-xs text-gray-400 mt-0.5">PDF, JPG, or PNG (max. 10MB)</p>
                                <label className="inline-flex mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer shadow">
                                    Select Files
                                    <input
                                        type="file"
                                        multiple
                                        className="hidden"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) => {
                                            handleStageFiles(e.target.files)
                                            e.target.value = ''
                                        }}
                                    />
                                </label>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-gray-450 uppercase tracking-wider mb-2.5">Selected Files</h4>
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                    {stagedFiles.map((item) => (
                                        <div key={item.id} className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex items-start gap-3">
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${getFileVisual(item).wrapper}`}>
                                                        {(() => {
                                                            const Icon = getFileVisual(item).icon
                                                            return <Icon className="w-4 h-4" />
                                                        })()}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900 truncate">{item.file.name}</p>
                                                        <p className="text-[10px] text-gray-400 mt-0.5">{Number((item.file.size / (1024 * 1024)).toFixed(2))} MB</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {item.status === 'failed' && (
                                                        <button
                                                            onClick={() => handleRetryStagedFile(item.id)}
                                                            className="text-blue-600 hover:text-blue-700 text-xs font-bold"
                                                            disabled={uploadingDocument}
                                                        >
                                                            Retry
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setStagedFiles((prev) => prev.filter((f) => f.id !== item.id))}
                                                        className="text-rose-500 hover:text-rose-700 text-[10px] font-bold"
                                                        disabled={uploadingDocument}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-2.5 h-1.5 rounded-full bg-slate-50 border border-slate-100 overflow-hidden">
                                                <div
                                                    className={`${item.status === 'failed' ? 'bg-rose-500' : item.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-600'} h-full transition-all duration-300`}
                                                    style={{ width: `${item.progress}%` }}
                                                ></div>
                                            </div>
                                            <div className="mt-1.5 text-[9px] font-bold">
                                                {item.status === 'completed' && <span className="text-emerald-600">Completed</span>}
                                                {item.status === 'failed' && <span className="text-rose-600">{item.error || 'Upload failed'}</span>}
                                                {(item.status === 'uploading' || item.status === 'ready') && <span className="text-blue-600">{item.progress}%</span>}
                                            </div>
                                        </div>
                                    ))}
                                    {stagedFiles.length === 0 && (
                                        <p className="text-xs text-gray-400 italic text-center py-4">No files selected.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-150 flex justify-end gap-3 bg-gray-50/50">
                            <button
                                onClick={() => setShowUploadModal(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 bg-white border border-gray-250 transition"
                                disabled={uploadingDocument}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadDocumentBatch}
                                disabled={uploadingDocument || stagedFiles.length === 0 || !uploadCategory}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow"
                            >
                                {uploadingDocument ? 'Uploading...' : 'Upload Document'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Document Confirmation */}
            {documentToDelete && (
                <div className="fixed inset-0 bg-black/35 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-sm font-bold text-slate-900">Delete document?</h3>
                        <p className="text-xs text-gray-500 mt-2">Are you sure you want to remove <span className="font-bold text-slate-800">{documentToDelete.file_name || 'this document'}</span>? This action cannot be undone.</p>
                        <div className="mt-5 flex justify-end gap-2.5">
                            <button onClick={() => setDocumentToDelete(null)} className="px-4 py-2 rounded-xl border border-gray-250 text-xs font-bold text-gray-600 hover:bg-gray-50 bg-white">Cancel</button>
                            <button onClick={handleDeleteDocument} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition shadow">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
