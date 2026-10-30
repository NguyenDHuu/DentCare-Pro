import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware'
import * as ctrl from './receptionist.controller'

const router = Router()

router.get('/dashboard',    authenticate, ctrl.getDashboard)
router.get('/patient',      authenticate, ctrl.lookupPatient)      // ?phone=
router.get('/services',     authenticate, ctrl.getServices)
router.get('/doctors',      authenticate, ctrl.getDoctors)         // ?serviceId= &weekStart=
router.get('/doctor-week',  authenticate, ctrl.getDoctorWeek)      // ?doctorId=  &weekStart=
router.get('/slots',        authenticate, ctrl.getSlots)           // ?doctorId=  &date=
router.get('/doctors-list',      authenticate, ctrl.listDoctors)        // plain dropdown list
router.get('/schedule-overview', authenticate, ctrl.getScheduleOverview) // ?weekStart=YYYY-MM-DD

// ── UC01-05: Appointment CRUD ─────────────────────────────────
router.post  ('/appointments',              authenticate, ctrl.createAppointment)
router.get   ('/appointments',              authenticate, ctrl.listAppointments)     // ?tab= &status= &doctorId= &search= &page= &limit=
router.get   ('/appointments/:id',          authenticate, ctrl.getAppointment)
router.put   ('/appointments/:id',          authenticate, ctrl.updateAppointment)
router.patch ('/appointments/:id/status',   authenticate, ctrl.patchStatus)
router.post  ('/appointments/:id/cancel',   authenticate, ctrl.cancelAppointment)

export default router
