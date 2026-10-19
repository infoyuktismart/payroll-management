import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { applyCompanyFilter, withCompanyScope } from '../services/tenantScope'
import { attendanceService } from '../services/attendanceService'
import { employeeService } from '../services/employeeService'
import { exitService } from '../services/exitService'
import { taxService } from '../services/taxService'
import { applySandwichRule } from '../lib/leaveUtils'
import { getIndianFinancialYear } from '../lib/taxUtils'
import { toast } from 'react-hot-toast'

// Centralized Query Key Factory for Portal Data Cache Scoping
export const portalKeys = {
    all: ['portalData'],
    employee: (viewAsId) => [...portalKeys.all, viewAsId || 'no-employee', 'employee'],
    payroll: (viewAsId) => [...portalKeys.all, viewAsId || 'no-employee', 'payroll'],
    timeoff: (viewAsId) => [...portalKeys.all, viewAsId || 'no-employee', 'timeoff'],
    attendance: (viewAsId) => [...portalKeys.all, viewAsId || 'no-employee', 'attendance'],
    notifications: (viewAsId) => [...portalKeys.all, viewAsId || 'no-employee', 'notifications'],
    documentsPage: (viewAsId, page, category) => [...portalKeys.all, viewAsId || 'no-employee', 'documents', { page, category }],
    ltaClaims: (viewAsId) => [...portalKeys.all, viewAsId || 'no-employee', 'ltaClaims'],
    nominees: (viewAsId) => [...portalKeys.all, viewAsId || 'no-employee', 'nominees'],
    orgChart: () => [...portalKeys.all, 'global', 'orgChart']
}

/**
 * 1. Fetch Core Employee profile (Exactly once at wrapper level)
 */
export const usePortalEmployee = (viewAsId) => {
    return useQuery({
        queryKey: portalKeys.employee(viewAsId),
        queryFn: async () => {
            if (!viewAsId) return null
            const { data, error } = await applyCompanyFilter(supabase.from('employees').select('*'))
                .eq('id', viewAsId)
                .single()
            if (error) throw error
            return data || null
        },
        enabled: !!viewAsId,
        staleTime: 5 * 60 * 1000 // 5 minutes cache
    })
}

/**
 * 2. Fetch Payroll Data (Lazy evaluated on click of Payroll tab)
 */
export const usePortalPayroll = (viewAsId, isTabActive) => {
    return useQuery({
        queryKey: portalKeys.payroll(viewAsId),
        queryFn: async () => {
            if (!viewAsId) return null
            const financialYear = getIndianFinancialYear()
            
            const [slipsRes, declarationRes] = await Promise.all([
                applyCompanyFilter(supabase.from('payroll_items').select(`
                    id, net_salary, basic_salary, total_deductions, total_allowances, attendance_days, breakdown, payroll_run_id,
                    payroll_run:payroll_runs ( month_year, status )
                `)).eq('employee_id', viewAsId).order('created_at', { ascending: false }),
                applyCompanyFilter(supabase.from('tax_declarations').select('*'))
                    .eq('employee_id', viewAsId)
                    .eq('financial_year', financialYear)
                    .maybeSingle()
            ])

            if (slipsRes.error) throw slipsRes.error
            if (declarationRes.error) throw declarationRes.error

            return {
                payslips: slipsRes.data || [],
                taxDeclaration: declarationRes.data || null
            }
        },
        enabled: !!viewAsId && !!isTabActive,
        staleTime: 5 * 60 * 1000
    })
}

/**
 * 3. Fetch Time Off & Leaves Data (Lazy evaluated on click of Time & Attendance tab)
 */
export const usePortalTimeOff = (viewAsId, isTabActive) => {
    return useQuery({
        queryKey: portalKeys.timeoff(viewAsId),
        queryFn: async () => {
            if (!viewAsId) return null
            const currentYear = new Date().getFullYear()

            const [leavesRes, policiesRes, balancesRes, holidaysRes] = await Promise.all([
                applyCompanyFilter(supabase.from('leaves').select('*')).eq('employee_id', viewAsId).order('created_at', { ascending: false }),
                applyCompanyFilter(supabase.from('leave_policies').select('*')).order('leave_type'),
                applyCompanyFilter(supabase.from('leave_balances').select('*')).eq('employee_id', viewAsId).eq('year', currentYear).order('leave_type'),
                applyCompanyFilter(supabase.from('holidays').select('date'))
            ])

            if (leavesRes.error) throw leavesRes.error
            if (policiesRes.error) throw policiesRes.error
            if (balancesRes.error) throw balancesRes.error
            if (holidaysRes.error) throw holidaysRes.error

            return {
                leaves: leavesRes.data || [],
                leavePolicies: policiesRes.data || [],
                leaveBalances: balancesRes.data || [],
                holidays: holidaysRes.data || []
            }
        },
        enabled: !!viewAsId && !!isTabActive,
        staleTime: 5 * 60 * 1000
    })
}

/**
 * 4. Fetch Attendance & Punch Data (Lazy evaluated on Time & Attendance tab)
 */
export const usePortalAttendance = (viewAsId, isTabActive) => {
    return useQuery({
        queryKey: portalKeys.attendance(viewAsId),
        queryFn: async () => {
            if (!viewAsId) return null
            const todayStr = new Date().toISOString().split('T')[0]

            const [attendanceRes, punchRes, regularizeRes] = await Promise.all([
                applyCompanyFilter(supabase.from('attendance').select('*')).eq('employee_id', viewAsId).order('date', { ascending: false }).limit(30),
                applyCompanyFilter(supabase.from('attendance_punches').select('*')).eq('employee_id', viewAsId).eq('date', todayStr).maybeSingle(),
                applyCompanyFilter(supabase.from('attendance_regularizations').select('*')).eq('employee_id', viewAsId).order('date', { ascending: false })
            ])

            if (attendanceRes.error) throw attendanceRes.error
            if (punchRes.error) throw punchRes.error
            if (regularizeRes.error) throw regularizeRes.error

            let todayPunch = null
            if (punchRes.data) {
                const { data: attRecord } = await applyCompanyFilter(supabase.from('attendance').select('work_mode, punch_location'))
                    .eq('employee_id', viewAsId)
                    .eq('date', todayStr)
                    .maybeSingle()

                todayPunch = {
                    ...punchRes.data,
                    work_mode: attRecord?.work_mode ? (attRecord.work_mode === 'hybrid' ? 'Client Site' : attRecord.work_mode.toUpperCase()) : 'WFO',
                    punch_location: attRecord?.punch_location || null
                }
            }

            return {
                attendanceLogs: attendanceRes.data || [],
                todayPunch,
                regularizationRequests: regularizeRes.data || []
            }
        },
        enabled: !!viewAsId && !!isTabActive,
        staleTime: 5 * 60 * 1000
    })
}

/**
 * 5. Fetch ESS Notifications count (Needed continuously on top bar)
 */
export const usePortalNotifications = (viewAsId) => {
    return useQuery({
        queryKey: portalKeys.notifications(viewAsId),
        queryFn: async () => {
            if (!viewAsId) return []
            const { data, error } = await supabase.from('notification_logs')
                .select('*')
                .eq('employee_id', viewAsId)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
            if (error) throw error
            return data || []
        },
        enabled: !!viewAsId,
        staleTime: 60 * 1000 // 1 minute fresh window for notifications
    })
}

/**
 * 6. Fetch paginated documents list (Lazy evaluated on Documents tab mount)
 */
export const usePortalDocumentsPage = (viewAsId, page, category, isTabActive) => {
    return useQuery({
        queryKey: portalKeys.documentsPage(viewAsId, page, category),
        queryFn: async () => {
            if (!viewAsId) return null
            const start = (page - 1) * 4
            const end = start + 3

            const { data, error, count } = await applyCompanyFilter(supabase
                .from('employee_documents')
                .select('*', { count: 'exact' }))
                .eq('employee_id', viewAsId)
                .eq('section', category)
                .order('created_at', { ascending: false })
                .range(start, end)

            if (error) throw error
            return {
                documents: data || [],
                count: count || 0
            }
        },
        enabled: !!viewAsId && !!isTabActive,
        staleTime: 5 * 60 * 1000
    })
}

/**
 * 7. Fetch LTA Travel claims (Lazy evaluated on Documents/Tax tab mount)
 */
export const usePortalLtaClaims = (viewAsId, isTabActive) => {
    return useQuery({
        queryKey: portalKeys.ltaClaims(viewAsId),
        queryFn: async () => {
            if (!viewAsId) return []
            const { data, error } = await applyCompanyFilter(supabase.from('lta_claims').select('*'))
                .eq('employee_id', viewAsId)
                .order('created_at', { ascending: false })
            if (error) throw error
            return data || []
        },
        enabled: !!viewAsId && !!isTabActive,
        staleTime: 5 * 60 * 1000
    })
}

/**
 * 8. Fetch Statutory Nominees List (Lazy evaluated on Job tab mount)
 */
export const usePortalNominees = (viewAsId, isTabActive) => {
    return useQuery({
        queryKey: portalKeys.nominees(viewAsId),
        queryFn: () => employeeService.getNominees(viewAsId),
        enabled: !!viewAsId && !!isTabActive,
        staleTime: 5 * 60 * 1000
    })
}

/**
 * 9. Fetch org chart listing of all employees (Lazy evaluated on Job tab mount)
 */
export const usePortalOrgChart = (isTabActive) => {
    return useQuery({
        queryKey: portalKeys.orgChart(),
        queryFn: async () => {
            return await employeeService.getAllEmployees()
        },
        enabled: !!isTabActive,
        staleTime: 30 * 60 * 1000 // Org chart changes rarely, 30 min cache
    })
}

/**
 * 10. Fetch active exit record
 */
export const usePortalExitData = (viewAsId, isTabActive) => {
    return useQuery({
        queryKey: [...portalKeys.all, viewAsId, 'exit'],
        queryFn: async () => {
            if (!viewAsId) return null
            return await exitService.getExitByEmployeeId(viewAsId)
        },
        enabled: !!viewAsId && !!isTabActive,
        staleTime: 5 * 60 * 1000
    })
}

/* =========================================================================
   MUTATIONS (strictly self-managing toast and query cache invalidations)
   ========================================================================= */

/**
 * Mutation hook to apply for leave. Uploads medical docs for Sick Leave >= 3 days.
 */
export const useApplyLeaveMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ leaveForm, holidays }) => {
            const diffDays = applySandwichRule(leaveForm.startDate, leaveForm.endDate, holidays)
            if (diffDays <= 0) {
                throw new Error('Selected dates do not contain payable leave days. Weekends and holidays are excluded.')
            }

            const isSickLeave = leaveForm.type === 'Sick Leave' || leaveForm.type === 'Sick'
            if (isSickLeave && diffDays >= 3 && !leaveForm.medicalFile) {
                throw new Error('Medical certificate is strictly mandatory for sick leave of 3 or more days.')
            }

            let medicalDocUrl = null
            if (leaveForm.medicalFile) {
                const fileExt = leaveForm.medicalFile.name.split('.').pop()
                const fileName = `${viewAsId}_sick_leave_${Date.now()}.${fileExt}`
                const storagePath = `leaves/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('employee-documents')
                    .upload(storagePath, leaveForm.medicalFile, {
                        cacheControl: '3600',
                        upsert: true
                    })

                if (uploadError) {
                    console.warn('Storage upload error:', uploadError)
                } else {
                    const { data: publicUrlData } = supabase.storage
                        .from('employee-documents')
                        .getPublicUrl(storagePath)
                    medicalDocUrl = publicUrlData?.publicUrl || null
                }
            }

            const { error } = await supabase.from('leaves').insert([withCompanyScope({
                employee_id: viewAsId,
                leave_type: leaveForm.type,
                start_date: leaveForm.startDate,
                end_date: leaveForm.endDate,
                reason: leaveForm.reason,
                status: 'pending',
                days: diffDays,
                medical_document_url: medicalDocUrl
            })])

            if (error) throw error
            return true
        },
        onSuccess: () => {
            toast.success('Leave application submitted! Your request has been sent for approval.')
            queryClient.invalidateQueries({ queryKey: portalKeys.all })
        },
        onError: (error) => {
            toast.error('Failed to apply leave: ' + error.message)
        }
    })
}

/**
 * Mutation hook to register a GPS-tracked check-in shift punch.
 */
export const usePunchInMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ workMode, userIp, punchLocation }) => {
            const todayStr = new Date().toISOString().split('T')[0]
            const punchInTime = new Date().toISOString()
            const dbWorkMode = workMode === 'Client Site' ? 'hybrid' : workMode.toLowerCase()

            const { error: punchError } = await supabase
                .from('attendance_punches')
                .insert([withCompanyScope({
                    employee_id: viewAsId,
                    date: todayStr,
                    punch_in: punchInTime,
                    ip_address: userIp
                })])
            if (punchError) throw punchError

            const { error: attError } = await supabase
                .from('attendance')
                .upsert(withCompanyScope({
                    employee_id: viewAsId,
                    date: todayStr,
                    status: 'present',
                    check_in: punchInTime,
                    check_out: null,
                    remarks: `Punched In (${workMode})`,
                    work_mode: dbWorkMode,
                    punch_location: punchLocation
                }), { onConflict: 'employee_id, date' })

            if (attError) throw attError
            return { workMode }
        },
        onSuccess: (data) => {
            toast.success(`Successfully Punched In (${data.workMode})! Have a great shift!`)
            queryClient.invalidateQueries({ queryKey: portalKeys.all })
        },
        onError: (error) => {
            toast.error('Error punching in: ' + error.message)
        }
    })
}

/**
 * Mutation hook to register a shift punch check-out and compute daily logs.
 */
export const usePunchOutMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ todayPunch, workMode, punchLocation }) => {
            if (!todayPunch) throw new Error('No active punch record found for today.')
            const punchOutTime = new Date().toISOString()
            const punchInTime = new Date(todayPunch.punch_in)
            const diffMs = new Date(punchOutTime).getTime() - punchInTime.getTime()
            const workingHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2))
            const dbWorkMode = workMode === 'Client Site' ? 'hybrid' : workMode.toLowerCase()

            const { error: punchError } = await supabase
                .from('attendance_punches')
                .update({
                    punch_out: punchOutTime,
                    working_hours: workingHours
                })
                .eq('id', todayPunch.id)
            if (punchError) throw punchError

            let status = 'present'
            if (workingHours <= 4) status = 'absent'
            else if (workingHours < 8) status = 'half_day'

            const todayStr = new Date().toISOString().split('T')[0]
            const { data: attData, error: attError } = await supabase
                .from('attendance')
                .upsert(withCompanyScope({
                    employee_id: viewAsId,
                    date: todayStr,
                    status: status,
                    check_in: todayPunch.punch_in,
                    check_out: punchOutTime,
                    remarks: `Web Punch-In (${workingHours} hrs worked)`,
                    work_mode: dbWorkMode,
                    punch_location: punchLocation
                }), { onConflict: 'employee_id, date' })
                .select()
                .single()

            if (attError) throw attError

            if (attData) {
                await attendanceService.calculateAndSaveOvertime(attData.id, todayPunch.punch_in, punchOutTime, viewAsId, todayStr)
                await attendanceService.calculateAndCreditCompOff(viewAsId, todayStr)
            }

            return { workingHours }
        },
        onSuccess: (data) => {
            toast.success(`Successfully Punched Out! Worked ${data.workingHours} hours.`)
            queryClient.invalidateQueries({ queryKey: portalKeys.all })
        },
        onError: (error) => {
            toast.error('Error punching out: ' + error.message)
        }
    })
}

/**
 * Mutation hook to register a new attendance regularization claim.
 */
export const useApplyRegularizationMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ date, requested_status, reason }) => {
            const { data: existing } = await applyCompanyFilter(
                supabase
                    .from('attendance_regularizations')
                    .select('id')
            )
                .eq('employee_id', viewAsId)
                .eq('date', date)
                .maybeSingle()

            if (existing) {
                throw new Error('A regularization request already exists for this date.')
            }

            const { error } = await supabase
                .from('attendance_regularizations')
                .insert([withCompanyScope({
                    employee_id: viewAsId,
                    date,
                    requested_status,
                    reason,
                    status: 'pending'
                })])

            if (error) throw error
            return true
        },
        onSuccess: () => {
            toast.success('Regularization request submitted successfully for approval!')
            queryClient.invalidateQueries({ queryKey: portalKeys.all })
        },
        onError: (error) => {
            toast.error('Error submitting regularization request: ' + error.message)
        }
    })
}

/**
 * Mutation hook to save/upsert a personal tax declaration form.
 */
export const useSaveTaxDeclarationMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ taxForm, taxFinancialYear }) => {
            const payload = {
                employee_id: viewAsId,
                financial_year: taxFinancialYear,
                regime: taxForm.regime,
                section_80c: Number(taxForm.section_80c || 0),
                section_80d: Number(taxForm.section_80d || 0),
                hra_exemption: Number(taxForm.hra_exemption || 0),
                home_loan_interest: Number(taxForm.home_loan_interest || 0),
                other_deductions: Number(taxForm.other_deductions || 0),
                other_income: Number(taxForm.other_income || 0),
                tds_already_deducted: Number(taxForm.tds_already_deducted || 0),
                status: 'submitted',
                updated_at: new Date().toISOString()
            }

            const { error } = await supabase
                .from('tax_declarations')
                .upsert(withCompanyScope(payload), { onConflict: 'employee_id,financial_year' })

            if (error) throw error
            return true
        },
        onSuccess: () => {
            toast.success('Tax declaration submitted for HR review.')
            queryClient.invalidateQueries({ queryKey: portalKeys.all })
        },
        onError: (error) => {
            toast.error('Unable to save tax declaration: ' + error.message)
        }
    })
}

/**
 * Mutation hook to dismiss/mark notifications read.
 */
export const useMarkNotificationAsReadMutation = (_viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (notificationId) => {
            const { error } = await supabase
                .from('notification_logs')
                .update({ is_read: true })
                .eq('id', notificationId)
            if (error) throw error
            return true
        },
        onSuccess: () => {
            toast.success('Notification marked as read')
            queryClient.invalidateQueries({ queryKey: portalKeys.all })
        },
        onError: (error) => {
            toast.error('Failed to update notification: ' + error.message)
        }
    })
}

/**
 * Mutation hook to register a new PF nominee.
 */
export const useCreateNomineeMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => employeeService.createNominee(payload),
        onSuccess: () => {
            toast.success('PF Nominee added successfully.')
            queryClient.invalidateQueries({ queryKey: portalKeys.nominees(viewAsId) })
        },
        onError: (error) => {
            toast.error('Failed to save nominee: ' + error.message)
        }
    })
}

/**
 * Mutation hook to update an existing PF nominee.
 */
export const useUpdateNomineeMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, payload }) => employeeService.updateNominee({ id, payload }),
        onSuccess: () => {
            toast.success('Nominee updated successfully.')
            queryClient.invalidateQueries({ queryKey: portalKeys.nominees(viewAsId) })
        },
        onError: (error) => {
            toast.error('Failed to save nominee: ' + error.message)
        }
    })
}

/**
 * Mutation hook to delete a PF nominee.
 */
export const useDeleteNomineeMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id) => employeeService.deleteNominee(id),
        onSuccess: () => {
            toast.success('Nominee removed successfully.')
            queryClient.invalidateQueries({ queryKey: portalKeys.nominees(viewAsId) })
        },
        onError: (error) => {
            toast.error('Failed to delete nominee: ' + error.message)
        }
    })
}

export const usePortalHraValidation = (viewAsId) => {
    return useQuery({
        queryKey: ['portalHraValidation', viewAsId],
        queryFn: async () => {
            if (!viewAsId) return { hraExemption: 0, hasRentReceipt: false }
            const fy = getIndianFinancialYear()
            const [declarations, docsRes] = await Promise.all([
                taxService.getEmployeeTaxDeclarations(viewAsId, fy),
                applyCompanyFilter(supabase.from('employee_documents').select('id'))
                    .eq('employee_id', viewAsId)
                    .eq('category', 'Rent Receipt')
                    .limit(1)
            ])
            const decl = declarations?.find(d => d.status === 'approved') || declarations?.[0]
            if (docsRes.error) throw docsRes.error
            return {
                hraExemption: Number(decl?.hra_exemption) || 0,
                hasRentReceipt: docsRes.data && docsRes.data.length > 0
            }
        },
        enabled: !!viewAsId,
        staleTime: 5 * 60 * 1000
    })
}

export const useCreateLtaClaimMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ year, amount }) => {
            const { error } = await supabase.from('lta_claims').insert([withCompanyScope({
                employee_id: viewAsId,
                financial_year: year,
                amount_claimed: parseFloat(amount),
                status: 'pending'
            })])
            if (error) throw error
            return true
        },
        onSuccess: () => {
            toast.success('LTA travel claim submitted for exemption!')
            queryClient.invalidateQueries({ queryKey: portalKeys.ltaClaims(viewAsId) })
        },
        onError: (err) => {
            toast.error('Failed to submit claim: ' + err.message)
        }
    })
}

export const useUploadDocumentMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ file, category, section }) => {
            const bucketName = 'employee-documents'
            const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const storagePath = `${viewAsId}/${Date.now()}_${safeFileName}`

            const { error: uploadError } = await supabase
                .storage
                .from(bucketName)
                .upload(storagePath, file, {
                    contentType: file.type,
                    upsert: false
                })

            if (uploadError) throw uploadError

            const { data: publicData } = supabase
                .storage
                .from(bucketName)
                .getPublicUrl(storagePath)

            const payload = {
                employee_id: viewAsId,
                file_name: file.name,
                category,
                section,
                status: 'pending',
                file_size_mb: Number((file.size / (1024 * 1024)).toFixed(2)),
                uploaded_at: new Date().toISOString(),
                mime_type: file.type,
                storage_path: storagePath,
                file_url: publicData?.publicUrl || null
            }

            const { error, data } = await supabase
                .from('employee_documents')
                .insert(withCompanyScope(payload))
                .select('*')
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: portalKeys.all })
            queryClient.invalidateQueries({ queryKey: ['portalHraValidation', viewAsId] })
        }
    })
}

export const useDeleteDocumentMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (doc) => {
            if (doc.storage_path) {
                const { error: removeErr } = await supabase.storage.from('employee-documents').remove([doc.storage_path])
                if (removeErr) throw removeErr
            }
            const { error } = await applyCompanyFilter(supabase
                .from('employee_documents')
                .delete())
                .eq('id', doc.id)
            if (error) throw error
            return true
        },
        onSuccess: () => {
            toast.success('Document removed successfully.')
            queryClient.invalidateQueries({ queryKey: portalKeys.all })
            queryClient.invalidateQueries({ queryKey: ['portalHraValidation', viewAsId] })
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to remove document.')
        }
    })
}

export const usePortalExit = (viewAsId, isTabActive) => {
    return useQuery({
        queryKey: ['portalExit', viewAsId],
        queryFn: async () => {
            if (!viewAsId) return null
            return await exitService.getExitByEmployeeId(viewAsId)
        },
        enabled: !!viewAsId && !!isTabActive,
        staleTime: 5 * 60 * 1000
    })
}

export const useInitiateResignationMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (resignationData) => {
            return await exitService.createExit({
                employee_id: viewAsId,
                ...resignationData,
                status: 'pending'
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portalExit', viewAsId] })
        }
    })
}

export const useUpdateExitStatusMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ exitId, newStatus }) => {
            return await exitService.updateExitStatus({
                id: exitId,
                status: newStatus,
                employeeId: viewAsId
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portalExit', viewAsId] })
            queryClient.invalidateQueries({ queryKey: portalKeys.employee(viewAsId) })
        }
    })
}

export const usePortalPrivacyConsent = (viewAsId) => {
    return useQuery({
        queryKey: ['portalPrivacyConsent', viewAsId],
        queryFn: async () => {
            if (!viewAsId) return null
            const { data, error } = await applyCompanyFilter(
                supabase
                    .from('privacy_consents')
                    .select('*')
            )
                .eq('employee_id', viewAsId)
                .order('accepted_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            if (error) throw error
            return data || null
        },
        enabled: !!viewAsId,
        staleTime: 5 * 60 * 1050
    })
}

export const useCreatePrivacyConsentMutation = (viewAsId) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ userIp }) => {
            const payload = withCompanyScope({
                employee_id: viewAsId,
                consent_version: '1.0',
                ip_address: userIp,
                accepted_at: new Date().toISOString(),
                metadata: {
                    browser: navigator.userAgent,
                    platform: navigator.platform,
                    compliance_frameworks: ['GDPR', 'DPDP_INDIA_2023']
                }
            })
            const { data, error } = await supabase
                .from('privacy_consents')
                .insert([payload])
                .select('*')
                .single()
            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portalPrivacyConsent', viewAsId] })
        }
    })
}

export const useAnonymizeProfileMutation = () => {
    return useMutation({
        mutationFn: async (employeeId) => {
            const { error } = await supabase.rpc('anonymize_employee_profile', {
                p_employee_id: employeeId
            })
            if (error) throw error
            return true
        }
    })
}

export const usePortalDownloadDataMutation = (viewAsId) => {
    return useMutation({
        mutationFn: async () => {
            if (!viewAsId) return null
            const [
                emp,
                attRes,
                leaveRes,
                taxRes,
                payrollRes,
                consentsRes
            ] = await Promise.all([
                employeeService.getEmployeeById(viewAsId),
                applyCompanyFilter(supabase.from('attendance').select('*')).eq('employee_id', viewAsId).order('date', { ascending: false }),
                applyCompanyFilter(supabase.from('leaves').select('*')).eq('employee_id', viewAsId).order('start_date', { ascending: false }),
                applyCompanyFilter(supabase.from('tax_declarations').select('*')).eq('employee_id', viewAsId),
                applyCompanyFilter(supabase.from('payroll_items').select('*')).eq('employee_id', viewAsId).order('created_at', { ascending: false }),
                applyCompanyFilter(supabase.from('privacy_consents').select('*')).eq('employee_id', viewAsId).order('accepted_at', { ascending: false })
            ])
            if (attRes.error) throw attRes.error
            if (leaveRes.error) throw leaveRes.error
            if (taxRes.error) throw taxRes.error
            if (payrollRes.error) throw payrollRes.error
            if (consentsRes.error) throw consentsRes.error

            return {
                employee: emp,
                attendance: attRes.data || [],
                leaves: leaveRes.data || [],
                taxDeclarations: taxRes.data || [],
                payrollItems: payrollRes.data || [],
                privacyConsents: consentsRes.data || []
            }
        }
    })
}
