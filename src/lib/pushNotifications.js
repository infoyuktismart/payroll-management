import { supabase } from './supabase'
import { devLog } from './devLogger'

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const isPushNotificationSupported = () => (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
)

export const getPushPermission = () => {
    if (!('Notification' in window)) return 'unsupported'
    return Notification.permission
}

export const requestPushPermission = async () => {
    if (!isPushNotificationSupported()) return 'unsupported'
    if (Notification.permission === 'granted') return 'granted'
    if (Notification.permission === 'denied') return 'denied'
    return Notification.requestPermission()
}

export const getServiceWorkerRegistration = async () => {
    if (!('serviceWorker' in navigator)) return null
    return navigator.serviceWorker.ready
}

export const subscribeToPushNotifications = async ({ userId, metadata = {} } = {}) => {
    if (!isPushNotificationSupported()) {
        return { subscription: null, status: 'unsupported' }
    }

    const permission = await requestPushPermission()
    if (permission !== 'granted') {
        return { subscription: null, status: permission }
    }

    if (!vapidPublicKey) {
        return { subscription: null, status: 'missing_vapid_key' }
    }

    const registration = await getServiceWorkerRegistration()
    if (!registration) return { subscription: null, status: 'no_service_worker' }

    const existing = await registration.pushManager.getSubscription()
    const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    })

    await persistPushSubscription({ subscription, userId, metadata })
    return { subscription, status: existing ? 'existing' : 'subscribed' }
}

export const unsubscribeFromPushNotifications = async () => {
    const registration = await getServiceWorkerRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return { status: 'not_subscribed' }
    await subscription.unsubscribe()
    return { status: 'unsubscribed' }
}

const persistPushSubscription = async ({ subscription, userId, metadata }) => {
    try {
        const payload = subscription.toJSON()
        const { error } = await supabase.functions.invoke('push-subscriptions', {
            body: {
                action: 'upsert',
                userId,
                subscription: payload,
                metadata
            }
        })
        if (error) throw error
    } catch (error) {
        devLog('Push subscription persistence skipped:', error)
    }
}

const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
