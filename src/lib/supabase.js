import { createClient } from '@supabase/supabase-js'
import { logger } from './devLogger'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    logger.warn('Missing Supabase URL or Key. Please Check .env file')
}

// Global fetch wrapper for Supabase JS client to provide automatic exponential backoff retries on network drops or server errors
const customFetch = async (url, options) => {
    const retries = 3
    const delayMs = 500
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, options)
            
            // Do not retry on client errors (4xx) except timeout (408) or rate limit (429)
            if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
                return response
            }
            
            // If server error (5xx) or rate limit, retry
            if (response.status >= 500 || response.status === 408 || response.status === 429) {
                if (attempt === retries - 1) return response
                const delay = delayMs * 2 ** attempt
                console.warn(`[Supabase Fetch] Status ${response.status}. Retrying attempt ${attempt + 1}/${retries} in ${delay}ms...`)
                await new Promise(r => setTimeout(r, delay))
                continue
            }
            
            return response
        } catch (err) {
            // Network errors (like going offline)
            if (attempt === retries - 1) {
                console.error(`[Supabase Fetch] Network error. All ${retries} retry attempts failed:`, err.message)
                throw err
            }
            const delay = delayMs * 2 ** attempt
            console.warn(`[Supabase Fetch] Network error: ${err.message}. Retrying attempt ${attempt + 1}/${retries} in ${delay}ms...`)
            await new Promise(r => setTimeout(r, delay))
        }
    }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
        fetch: customFetch
    }
})
