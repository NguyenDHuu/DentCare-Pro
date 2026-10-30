import { Router } from 'express'
import * as ctrl from './schedule.controller'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'

const router = Router()
const admin = [authenticate, requireRole('ADMIN')] as const
const auth  = [authenticate] as const

// UC08 – Lịch trực bác sĩ
router.get('/form-data',       ...admin, ctrl.getFormData)
router.get('/',                ...auth,  ctrl.getWeekSchedules)
router.post('/',               ...admin, ctrl.createSchedule)
router.put('/:id',             ...admin, ctrl.updateSchedule)
router.delete('/:id',          ...admin, ctrl.deleteSchedule)
// Phân công hàng loạt nhiều ngày
router.post('/batch/preview',  ...admin, ctrl.previewBatch)
router.post('/batch',          ...admin, ctrl.createBatch)

export default router
