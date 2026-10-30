import { Router } from 'express'
import * as ctrl from './service.controller'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'

const router = Router()

const admin = [authenticate, requireRole('ADMIN')] as const

// ─── UC08 ────────────────────────────────────────────────────
router.get('/doctors',             ...admin, ctrl.getDoctors)
router.get('/groups',              ...admin, ctrl.getServiceGroups)
router.post('/groups',             ...admin, ctrl.createServiceGroup)
router.put('/groups/:id',          ...admin, ctrl.updateServiceGroup)
router.delete('/groups/:id',       ...admin, ctrl.deleteServiceGroup)
router.get('/groups/:id/services', ...admin, ctrl.getGroupServices)

// ─── UC09 ────────────────────────────────────────────────────
router.get('/',                    ...admin, ctrl.getServices)
router.post('/',                   ...admin, ctrl.createService)
router.get('/:id',                 ...admin, ctrl.getServiceById)
router.put('/:id',                 ...admin, ctrl.updateService)
router.delete('/:id',              ...admin, ctrl.deleteService)
router.patch('/:id/status',        ...admin, ctrl.changeServiceStatus)

export default router
