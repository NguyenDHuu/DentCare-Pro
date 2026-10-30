import { Router } from 'express'
import * as ctrl from './shift.controller'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'

const router = Router()
const admin = [authenticate, requireRole('ADMIN')] as const

// UC06 – Ca làm việc
router.get('/',              ...admin, ctrl.getShifts)
router.post('/',             ...admin, ctrl.createShift)
router.put('/:id',           ...admin, ctrl.updateShift)
router.delete('/:id',        ...admin, ctrl.deleteShift)
router.patch('/:id/toggle',  ...admin, ctrl.toggleShift)

export default router
