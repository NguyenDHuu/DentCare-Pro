import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'
import * as ctrl from './doctor.controller'

const router = Router()

router.get  ('/my-schedule',              authenticate, requireRole('DOCTOR'), ctrl.getMySchedule)
router.get  ('/group-schedule',           authenticate, requireRole('DOCTOR'), ctrl.getGroupSchedule)
router.get  ('/appointments',             authenticate, requireRole('DOCTOR'), ctrl.listMyAppointments)
router.patch('/appointments/:id/status',  authenticate, requireRole('DOCTOR'), ctrl.patchMyAppointmentStatus)
router.get  ('/today-receptions',         authenticate, requireRole('DOCTOR'), ctrl.getTodayReceptions)

export default router
