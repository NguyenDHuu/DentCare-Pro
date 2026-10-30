import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware'
import * as ctrl from './invoice.controller'

const router = Router()
router.use(authenticate)

// GET  /api/invoice          — list (status, search, page)
router.get('/',            ctrl.listInvoices)

// GET  /api/invoice/stats    — revenue statistics
router.get('/stats',       ctrl.getStats)

// GET  /api/invoice/:id      — detail
router.get('/:id',         ctrl.getInvoice)

// POST /api/invoice/:id/discount — apply voucher / discount
router.post('/:id/discount', ctrl.applyDiscount)

// POST /api/invoice/:id/pay  — xác nhận thanh toán
router.post('/:id/pay',    ctrl.payInvoice)

// POST /api/invoice/:id/cancel
router.post('/:id/cancel', ctrl.cancelInvoice)

export default router
