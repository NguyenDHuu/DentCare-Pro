import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware'
import * as ctrl from './profile.controller'

const router = Router()

router.get('/', authenticate, ctrl.getMyProfile)
router.put('/', authenticate, ctrl.updateMyProfile)

export default router
