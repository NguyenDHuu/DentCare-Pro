import { Router } from 'express'
import multer from 'multer'
import * as ctrl from './auth.controller'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg']
    cb(null, allowed.includes(file.mimetype))
  },
})

const router = Router()

// Public
router.get('/check-setup',      ctrl.checkSetup)
router.post('/setup',           ctrl.setupAdmin)
router.post('/register',        ctrl.registerAdmin)
router.post('/login',           ctrl.login)
router.post('/forgot-password', ctrl.requestReset)
router.post('/reset-password',  ctrl.resetPassword)

// Logout
router.post('/logout', authenticate, ctrl.logout)

// Protected — any authenticated user
router.post('/change-password', authenticate, ctrl.changePassword)

// Protected — ADMIN only
router.get('/logs',                     authenticate, requireRole('ADMIN'), ctrl.getLogs)
router.get('/logs/export',              authenticate, requireRole('ADMIN'), ctrl.exportLogs)
router.get('/stats',                    authenticate, requireRole('ADMIN'), ctrl.getDashboardStats)
router.get('/users',                    authenticate, requireRole('ADMIN'), ctrl.getUsers)
router.post('/users',                   authenticate, requireRole('ADMIN'), ctrl.createStaff)
router.get('/users/:id',                authenticate, requireRole('ADMIN'), ctrl.getUserById)
router.put('/users/:id/roles',          authenticate, requireRole('ADMIN'), ctrl.updateUserRoles)
router.put('/users/:id/profile',        authenticate, requireRole('ADMIN'), ctrl.updateUserProfile)
router.post('/users/:id/reset-password',authenticate, requireRole('ADMIN'), ctrl.adminResetPassword)
router.post('/users/:id/send-email',    authenticate, requireRole('ADMIN'), upload.array('files', 5), ctrl.sendEmailToUser)
router.patch('/users/:id/status',       authenticate, requireRole('ADMIN'), ctrl.toggleUserStatus)

router.delete('/users/:id',             authenticate, requireRole('ADMIN'), ctrl.deleteUser)

// Bằng cấp & Chứng chỉ
router.get('/users/:id/certificates',                   authenticate, requireRole('ADMIN'), ctrl.getCertificates)
router.post('/users/:id/certificates',                  authenticate, requireRole('ADMIN'), upload.single('file'), ctrl.uploadCertificate)
router.delete('/users/:id/certificates/:certId',        authenticate, requireRole('ADMIN'), ctrl.deleteCertificate)

export default router