/**
 * Retries an async function with exponential backoff.
 * Does NOT retry on 4xx errors (client errors are not transient).
 * @param {() => Promise<any>} fn
 * @param {{ retries?: number, delayMs?: number }} options
 */
export async function withRetry(fn, { retries = 3, delayMs = 500 } = {}) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await fn()
        } catch (err) {
            const status = err?.status || err?.code
            const isClientError = status && (
                (typeof status === 'number' && status >= 400 && status < 500) ||
                (typeof status === 'string' && (status.startsWith('4') || status === 'PGRST116' || status === '23505'))
            )
            
            if (isClientError || attempt === retries - 1) throw err
            await new Promise(r => setTimeout(r, delayMs * 2 ** attempt))
        }
    }
}
