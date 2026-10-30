import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware'
import * as ctrl from './treatment.controller'

const router = Router()
router.use(authenticate)

// GET  /api/treatment/queue                     — hàng chờ điều trị hôm nay
router.get('/queue', ctrl.getQueue)

// GET  /api/treatment/services                  — dịch vụ active
router.get('/services', ctrl.getServices)

// GET  /api/treatment/reception/:receptionId    — get or create draft cho 1 lần tiếp đón
router.get('/reception/:receptionId', ctrl.getOrCreate)

// GET  /api/treatment/:id                       — chi tiết hồ sơ
router.get('/:id', ctrl.getRecord)

// PUT  /api/treatment/:id                       — lưu nháp
router.put('/:id', ctrl.saveDraft)

// POST /api/treatment/:id/sign                  — ký số & chốt
router.post('/:id/sign', ctrl.signRecord)

// GET  /api/treatment/patient/:patientId/history
router.get('/patient/:patientId/history', ctrl.getPatientHistory)

export default router
