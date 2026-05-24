/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from './ToastContext'
import { useAuth } from './AuthContext'

const CompanyContext = createContext(null)

export const useCompany = () => {
    const ctx = useContext(CompanyContext)
    if (!ctx) throw new Error('useCompany must be used within a CompanyProvider')
    return ctx
}

export const CompanyProvider = ({ children }) => {
    const { user } = useAuth()
    const toast = useToast()
    const [company, setCompany] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchCompanySettings = useCallback(async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('company_settings')
                .select('*')
                .limit(1)
                .single()

            if (error) {
                // If no row found, it's fine, we will handle empty state gracefully
                if (error.code !== 'PGRST116') {
                    throw error
                }
            } else {
                setCompany(data)
            }
        } catch (error) {
            console.error('Error fetching company settings:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (user) {
            fetchCompanySettings()
        } else {
            setCompany(null)
            setLoading(false)
        }
    }, [user, fetchCompanySettings])

    const updateCompany = async (updates) => {
        try {
            setLoading(true)
            let res
            if (company?.id) {
                // Update existing record
                res = await supabase
                    .from('company_settings')
                    .update(updates)
                    .eq('id', company.id)
                    .select()
                    .single()
            } else {
                // Insert new record
                res = await supabase
                    .from('company_settings')
                    .insert([updates])
                    .select()
                    .single()
            }

            if (res.error) throw res.error

            setCompany(res.data)
            toast.success('Company settings updated successfully!')
            return { success: true, data: res.data }
        } catch (error) {
            toast.error('Error updating company settings: ' + error.message)
            return { success: false, error }
        } finally {
            setLoading(false)
        }
    }

    const value = {
        company,
        loading,
        updateCompany,
        refreshCompany: fetchCompanySettings
    }

    return (
        <CompanyContext.Provider value={value}>
            {children}
        </CompanyContext.Provider>
    )
}
