import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware'
import * as ctrl from './reception.controller'

const router = Router()

// All routes require authentication
router.use(authenticate)

// GET  /api/reception/queue                        — hàng chờ hôm nay + ghế + thống kê
router.get('/queue', ctrl.getQueue)

// GET  /api/reception/chairs                       — trạng thái ghế khám
router.get('/chairs', ctrl.getChairs)

// GET  /api/reception/search-patients?q=...        — tìm kiếm BN khi check-in
router.get('/search-patients', ctrl.searchPatients)

// GET  /api/reception/doctors                      — danh sách bác sĩ available
router.get('/doctors', ctrl.getDoctors)

// POST /api/reception/checkin                      — check-in bệnh nhân
router.post('/checkin', ctrl.checkIn)

// GET  /api/reception/:id                          — chi tiết 1 bản ghi tiếp đón
router.get('/:id', ctrl.getReception)

// PUT  /api/reception/:id/status                   — cập nhật trạng thái
router.put('/:id/status', ctrl.updateStatus)

// PUT  /api/reception/:id/assign                   — phân công ghế + bác sĩ
router.put('/:id/assign', ctrl.assignResources)

// GET  /api/reception/patients/:patientId/history  — lịch sử tiếp đón của BN
router.get('/patients/:patientId/history', ctrl.getPatientHistory)

// PATCH /api/reception/patients/:patientId/classification — thay đổi phân loại BN
router.patch('/patients/:patientId/classification', ctrl.changeClassification)

export default router
