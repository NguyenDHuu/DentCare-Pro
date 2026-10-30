import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export const sendWelcomeEmail = async (
  to: string,
  fullName: string,
  username: string,
  password: string
) => {
  await transporter.sendMail({
    from: `"Nha Khoa" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: 'Tài khoản hệ thống của bạn đã được tạo',
    html: `
      <p>Xin chào <strong>${fullName}</strong>,</p>
      <p>Tài khoản của bạn đã được tạo thành công. Thông tin đăng nhập:</p>
      <ul>
        <li><strong>Tên đăng nhập:</strong> ${username}</li>
        <li><strong>Mật khẩu:</strong> ${password}</li>
      </ul>
      <p>Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên.</p>
    `,
  })
}

export const sendAdminPasswordResetEmail = async (
  to: string,
  fullName: string,
  newPassword: string
) => {
  await transporter.sendMail({
    from: `"Nha Khoa" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: 'Mật khẩu của bạn đã được đặt lại',
    html: `
      <p>Xin chào <strong>${fullName}</strong>,</p>
      <p>Quản trị viên vừa đặt lại mật khẩu cho tài khoản của bạn.</p>
      <p><strong>Mật khẩu mới:</strong> ${newPassword}</p>
      <p>Vui lòng đổi mật khẩu sau khi đăng nhập lại.</p>
    `,
  })
}

export interface EmailAttachment {
  filename: string
  buffer: Buffer
  mimetype: string
}

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const sendCustomEmail = async (
  to: string,
  subject: string,
  content: string,
  attachments: EmailAttachment[] = []
) => {
  await transporter.sendMail({
    from: `"Nha Khoa" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject,
    html: `<div style="white-space:pre-wrap">${escapeHtml(content)}</div>`,
    attachments: attachments.map(a => ({
      filename: a.filename,
      content: a.buffer,
      contentType: a.mimetype,
    })),
  })
}

export const sendPasswordResetEmail = async (to: string, token: string) => {
  const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`

  await transporter.sendMail({
    from: `"Nha Khoa" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: 'Đặt lại mật khẩu',
    html: `
      <p>Bạn đã yêu cầu đặt lại mật khẩu.</p>
      <p>Nhấn vào liên kết bên dưới để đặt lại mật khẩu (có hiệu lực trong 30 phút):</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
    `,
  })
}
