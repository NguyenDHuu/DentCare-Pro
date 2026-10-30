import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware'
import * as ctrl from './patient.controller'

const router = Router()

router.get   ('/',             authenticate, ctrl.listPatients)
router.post  ('/',             authenticate, ctrl.createPatient)
router.get   ('/:id',              authenticate, ctrl.getPatient)
router.get   ('/:id/appointments', authenticate, ctrl.getPatientAppointments)
router.put   ('/:id',         authenticate, ctrl.updatePatient)
router.patch ('/:id/deactivate', authenticate, ctrl.deactivatePatient)

export default router
