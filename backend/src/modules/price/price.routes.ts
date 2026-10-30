import { Router } from 'express'
import * as ctrl from './price.controller'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'

const router = Router()

const admin    = [authenticate, requireRole('ADMIN')]     as const
const readOnly = [authenticate, requireRole('ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')] as const

// ─── UC10 ─────────────────────────────────────────────────────
router.get('/',                        ...readOnly, ctrl.getPrices)
router.get('/:serviceId/history',      ...readOnly, ctrl.getPriceHistory)
router.post('/',                       ...admin,    ctrl.createPrice)
router.put('/:id',                     ...admin,    ctrl.updatePrice)

export default router
