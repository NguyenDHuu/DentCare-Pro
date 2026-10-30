import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const ACTION_MODULE: Record<string, string> = {
  SETUP_ADMIN:          'Auth',
  REGISTER_ADMIN:       'Auth',
  LOGIN:                'Auth',
  LOGIN_FAILED:         'Auth',
  LOGOUT:               'Auth',
  CHANGE_PASSWORD:      'Auth',
  REQUEST_RESET_PASSWORD: 'Auth',
  RESET_PASSWORD:       'Auth',
  CREATE_STAFF:         'User',
  UPDATE_ROLES:         'User',
  TOGGLE_STATUS:        'User',
  DELETE_USER:          'User',
  UPDATE_PROFILE:       'User',
  ADMIN_RESET_PASSWORD: 'User',
  SEND_EMAIL:           'User',
  UPLOAD_CERTIFICATE:   'User',
  DELETE_CERTIFICATE:   'User',
  CREATE_SERVICE_GROUP:   'Service',
  UPDATE_SERVICE_GROUP:   'Service',
  DELETE_SERVICE_GROUP:   'Service',
  CREATE_SERVICE:         'Service',
  UPDATE_SERVICE:         'Service',
  CHANGE_SERVICE_STATUS:  'Service',
  DELETE_SERVICE:         'Service',
  CREATE_PRICE:           'Price',
  UPDATE_PRICE:           'Price',
  CREATE_SHIFT:           'Shift',
  UPDATE_SHIFT:           'Shift',
  DELETE_SHIFT:           'Shift',
  TOGGLE_SHIFT:           'Shift',
  CREATE_SCHEDULE:        'Schedule',
  UPDATE_SCHEDULE:        'Schedule',
  DELETE_SCHEDULE:        'Schedule',
  CREATE_HOLIDAY:         'Holiday',
  UPDATE_HOLIDAY:         'Holiday',
  DELETE_HOLIDAY:         'Holiday',
  UPDATE_SMS_CONFIG:      'SMS',
  UPDATE_SMS_TEMPLATE:    'SMS',
  SEND_TEST_SMS:          'SMS',
}

export const logAction = async (
  action: string,
  detail?: string,
  userId?: number,
  ip?: string,
  status: 'SUCCESS' | 'FAILED' = 'SUCCESS'
) => {
  try {
    const module = ACTION_MODULE[action] ?? 'System'
    await prisma.systemLog.create({
      data: { action, detail, userId, ip, status, module }
    })
  } catch {
    console.error('[Logger] Failed to write log:', action)
  }
}
