import { logger } from './devLogger'

const PUBLIC_IP_ENDPOINT = 'https://api.ipify.org?format=json'
const FALLBACK_IP = '127.0.0.1'

export const getPublicIpAddress = async ({ timeoutMs = 4000 } = {}) => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(PUBLIC_IP_ENDPOINT, { signal: controller.signal })
        if (!response.ok) {
            throw new Error(`IP lookup failed with status ${response.status}`)
        }

        const data = await response.json()
        return data?.ip || FALLBACK_IP
    } catch (error) {
        logger.warn('Public IP lookup failed; using fallback IP.', error)
        return FALLBACK_IP
    } finally {
        window.clearTimeout(timeout)
    }
}
