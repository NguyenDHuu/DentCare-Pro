import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import authRoutes from './modules/auth/auth.routes'
import serviceRoutes from './modules/service/service.routes'
import priceRoutes from './modules/price/price.routes'
import profileRoutes from './modules/profile/profile.routes'
import shiftRoutes    from './modules/shift/shift.routes'
import scheduleRoutes from './modules/schedule/schedule.routes'
import holidayRoutes  from './modules/holiday/holiday.routes'
import smsRoutes          from './modules/sms/sms.routes'
import receptionistRoutes from './modules/receptionist/receptionist.routes'
import doctorRoutes      from './modules/doctor/doctor.routes'
import patientRoutes     from './modules/patient/patient.routes'
import receptionRoutes  from './modules/reception/reception.routes'
import treatmentRoutes  from './modules/treatment/treatment.routes'
import invoiceRoutes    from './modules/invoice/invoice.routes'
import salaryRoutes    from './modules/salary/salary.routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// ── Auto-cancel scheduler ─────────────────────────────────────
// Chạy mỗi phút: hủy lịch hẹn PENDING đã quá 30 phút so với giờ hẹn
import { PrismaClient } from '@prisma/client'
const prismaScheduler = new PrismaClient()

async function autoCancelOverdueAppointments() {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000) // now - 30 phút
    const result = await prismaScheduler.appointment.updateMany({
      where: {
        status:          'PENDING',
        appointmentDate: { lt: cutoff },
      },
      data: {
        status:       'CANCELLED',
        cancelReason: 'Tự động hủy – quá 30 phút không được xác nhận',
      },
    })
    if (result.count > 0) {
      console.log(`[auto-cancel] Đã hủy ${result.count} lịch hẹn PENDING quá hạn`)
    }
  } catch (err) {
    console.error('[auto-cancel] Lỗi:', err)
  }
}

// Chạy ngay lần đầu khi khởi động, sau đó lặp mỗi 60 giây
autoCancelOverdueAppointments()
setInterval(autoCancelOverdueAppointments, 60 * 1000)

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))
app.use(express.json())

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))
app.use('/api/auth', authRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/prices', priceRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/shifts',    shiftRoutes)
app.use('/api/schedules', scheduleRoutes)
app.use('/api/holidays',  holidayRoutes)
app.use('/api/sms',          smsRoutes)
app.use('/api/receptionist', receptionistRoutes)
app.use('/api/doctor',      doctorRoutes)
app.use('/api/patients',    patientRoutes)
app.use('/api/reception',   receptionRoutes)
app.use('/api/treatment',   treatmentRoutes)
app.use('/api/invoice',     invoiceRoutes)
app.use('/api/salary',      salaryRoutes)
app.get('/health', (_, res) => res.json({ status: 'OK' }))

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})

export default app