import fs from 'fs'
import dotenv from 'dotenv'
import convict from 'convict'
import validators from 'convict-format-with-validator'

const { NODE_ENV = '' } = process.env

const logLevels = new Set(['info', 'warn', 'error', 'debug', 'trace'])

convict.addFormats(validators)
convict.addFormats({
  'required-string': {
    validate: (val: any): void => {
      if (val === '') {
        throw new Error('Required value cannot be empty')
      }
    },
    coerce: (val: any): any => {
      if (val === null) {
        return undefined
      }
      return val
    }
  },
  'boolean': {
    validate: (val: any): void => {
      return val
    },
    coerce: (val: any) => {
      switch (val.toString().trim()) {
        case '':
        case '0':
        case 'false':
          return false
        case '1':
        case 'true':
          return true
        default:
          throw new Error(`invalid value ${val}`)
      }
    }
  },
  'cmd': {
    validate: (val: any): void => {
      return val
    },
    coerce: (val: any) => {
      if (!val) {
        return []
      }

      return val.toString().split(' ').map(v => v.trim())
    }
  },
  'log-level': {
    validate: (val: any): void => {
      if (!logLevels.has(val.toString())) {
        throw new Error(`Invalid log level "${val}". Supported values: ${Array.from(logLevels).join(', ')}`)
      }
    }
  }
})

export const autoload = () => {
  if (NODE_ENV === '') {
    return
  }

  const envFile = `./${NODE_ENV}.env`
  try {
    if (!fs.existsSync(envFile)) {
      return
    }

    dotenv.config({
      path: envFile
    })
  } catch (err) {
    console.error(`Error: failed to autoload env from "${envFile}": ${err}`)
  }
}
