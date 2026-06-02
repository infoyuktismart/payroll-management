import * as Sentry from '@sentry/react'

const isDev = import.meta.env.DEV
const isProd = import.meta.env.PROD

const normalizeExtra = (args) => ({
  args: args.map((arg) => {
    if (arg instanceof Error) {
      return { name: arg.name, message: arg.message, stack: arg.stack }
    }
    return arg
  }),
})

export const logger = {
  info: (...args) => {
    if (isDev) console.info('[INFO]', ...args)
  },
  warn: (...args) => {
    if (isDev) console.warn('[WARN]', ...args)
    if (isProd) Sentry.captureMessage(String(args[0]), {
      level: 'warning',
      extra: normalizeExtra(args),
    })
  },
  error: (...args) => {
    if (isDev) console.error('[ERROR]', ...args)
    const err = args.find(a => a instanceof Error) || new Error(String(args[0]))
    if (isProd) Sentry.captureException(err, { extra: normalizeExtra(args) })
  },
}

export const devLog = logger.info
export const devError = logger.error
