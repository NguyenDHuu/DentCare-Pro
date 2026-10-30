/**
 * SMS Gateway – eSMS.io integration
 *
 * API doc: https://esms.vn/public-api/public-api-sms
 * Endpoint: POST https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/
 *
 * CodeResult meanings:
 *   100 – gửi thành công
 *   101 – đăng nhập sai (ApiKey / SecretKey không đúng)
 *   102 – số điện thoại không hợp lệ
 *   103 – số dư tài khoản không đủ
 *   104 – vượt giới hạn gửi hàng ngày
 *   119 – Brandname chưa đăng ký
 *   others – lỗi khác
 */

import axios, { AxiosError } from 'axios'

const ESMS_URL =
  'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/'

const CODE_MSG: Record<string, string> = {
  '100': 'Thành công',
  '101': 'ApiKey hoặc SecretKey không đúng',
  '102': 'Số điện thoại không hợp lệ',
  '103': 'Số dư tài khoản eSMS không đủ',
  '104': 'Vượt quá giới hạn gửi SMS trong ngày',
  '119': 'Brandname chưa được đăng ký trên eSMS',
}

export interface GatewayConfig {
  apiKey:    string
  secretKey: string
  brandname: string
}

export interface SendResult {
  success:  boolean
  smsId?:   string
  code:     string
  message:  string
}

/**
 * Send a single SMS via eSMS.io.
 * Will attempt up to `maxRetries` times on network errors (not on API errors).
 */
export async function sendSmsEsms(
  phone:      string,
  content:    string,
  cfg:        GatewayConfig,
  maxRetries: number = 3,
): Promise<SendResult> {
  const digits = phone.replace(/\D/g, '')
  const payload = {
    ApiKey:    cfg.apiKey,
    Content:   content,
    Phone:     digits,
    SecretKey: cfg.secretKey,
    Brandname: cfg.brandname,
    SmsType:   '2',    // quảng cáo có brandname
    IsUnicode: '1',    // UTF-8 (tiếng Việt)
  }

  let lastError: string = 'Unknown error'

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.post<{
        CodeResult: string
        SMSID:      string
        ErrorMessage?: string
      }>(ESMS_URL, payload, {
        headers:        { 'Content-Type': 'application/json' },
        timeout:        10_000, // 10 s
        validateStatus: () => true, // handle HTTP errors ourselves
      })

      const { CodeResult, SMSID } = res.data
      const code    = String(CodeResult)
      const message = CODE_MSG[code] ?? `Lỗi từ eSMS (code ${code})`

      if (code === '100') {
        return { success: true, smsId: SMSID, code, message }
      }

      // API-level errors – no point retrying
      return { success: false, smsId: SMSID, code, message }
    } catch (err) {
      const axErr = err as AxiosError
      lastError = axErr.message ?? String(err)

      if (attempt < maxRetries) {
        // Brief back-off before retry (500 ms × attempt)
        await new Promise(r => setTimeout(r, 500 * attempt))
      }
    }
  }

  return {
    success: false,
    code:    'NETWORK_ERROR',
    message: `Không kết nối được eSMS sau ${maxRetries} lần thử: ${lastError}`,
  }
}
