import { Router } from 'express'
import * as ctrl from './holiday.controller'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'

const router = Router()
const admin  = [authenticate, requireRole('ADMIN')] as const

router.get('/',       ...admin, ctrl.getHolidays)
router.post('/',      ...admin, ctrl.createHoliday)
router.put('/:id',    ...admin, ctrl.updateHoliday)
router.delete('/:id', ...admin, ctrl.deleteHoliday)

export default router
