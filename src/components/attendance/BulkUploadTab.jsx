import { FileUp, Upload, Download, AlertTriangle } from 'lucide-react'

export default function BulkUploadTab({
    isUploading,
    uploadStats,
    uploadReport,
    csvFile,
    setCsvFile,
    onFileUpload,
    onBulkSubmit,
    downloadTemplate
}) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-3xl mx-auto">
                <div className="space-y-6">
                    <div className={`border-2 border-dashed rounded-2xl p-10 transition-all text-center relative ${csvFile ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'}`}>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={onFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="space-y-3">
                            {csvFile ? (
                                <>
                                    <FileUp className="w-12 h-12 text-blue-600 mx-auto" />
                                    <div>
                                        <p className="text-lg font-bold text-slate-800">{csvFile.name}</p>
                                        <p className="text-sm text-gray-500">{(csvFile.size / 1024).toFixed(2)} KB</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-12 h-12 text-gray-300 mx-auto" />
                                    <div>
                                        <p className="text-lg font-bold text-gray-700">Click to upload or drag and drop</p>
                                        <p className="text-sm text-gray-400 mt-1">CSV files only (Column format: Employee_ID, Date, Status, Check_In, Check_Out)</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4">
                        <button onClick={downloadTemplate} className="flex items-center space-x-2 text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors cursor-pointer">
                            <Download className="w-4 h-4" />
                            <span>Download Template CSV</span>
                        </button>

                        {csvFile && (
                            <button
                                onClick={onBulkSubmit}
                                disabled={isUploading}
                                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center space-x-2 shadow-lg shadow-slate-200 transition-all active:scale-95 cursor-pointer"
                            >
                                {isUploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        <span>Start Upload</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Upload Stats */}
                    {uploadStats && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-slate-50 p-4 rounded-xl text-center border border-gray-100">
                                    <p className="text-xs font-bold text-gray-400 uppercase">Total Records</p>
                                    <p className="text-2xl font-black text-slate-800">{uploadStats.total}</p>
                                </div>
                                <div className="bg-emerald-50 p-4 rounded-xl text-center border border-emerald-100">
                                    <p className="text-xs font-bold text-emerald-600 uppercase">Successful</p>
                                    <p className="text-2xl font-black text-emerald-600">{uploadStats.success}</p>
                                </div>
                                <div className="bg-rose-50 p-4 rounded-xl text-center border border-rose-100">
                                    <p className="text-xs font-bold text-rose-600 uppercase">Failed</p>
                                    <p className="text-2xl font-black text-rose-600">{uploadStats.failed}</p>
                                </div>
                            </div>

                            {uploadReport.length > 0 && (
                                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center space-x-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                        <h4 className="font-bold text-gray-700 text-sm">Issue Report</h4>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 text-gray-500 font-bold text-xs uppercase sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2">Emp ID</th>
                                                    <th className="px-4 py-2">Date</th>
                                                    <th className="px-4 py-2">Error</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {uploadReport.map((row, i) => (
                                                    <tr key={i} className="hover:bg-gray-50">
                                                        <td className="px-4 py-2 font-medium text-gray-800">{row.Employee_ID || '-'}</td>
                                                        <td className="px-4 py-2 text-gray-600">{row.Date || '-'}</td>
                                                        <td className="px-4 py-2 text-rose-600 font-medium">{row.error}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
