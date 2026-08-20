export const HTMLTemplate = function (resetCode) {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your Chatify password</title>
</head>
<body style="margin: 0; padding: 0; background: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #ffffff; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
    Use this code to reset your Chatify password. It expires in 5 minutes.
  </div>
  <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="background: #000000;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="width: 100%; max-width: 560px; background: #111827; border: 1px solid #1f2937; border-radius: 16px;">
          <tr>
            <td style="padding: 32px 32px 20px;">
              <table border="0" cellspacing="0" cellpadding="0" role="presentation" style="margin: 0 0 22px;">
                <tr>
                  <td style="width: 44px; height: 44px; background: #000000; border: 1px solid #1f2937; border-radius: 12px;" align="center">
                    <span style="display: inline-block; width: 24px; height: 16px; background: #00FF00; border-radius: 7px;"></span>
                  </td>
                  <td style="padding-left: 12px; color: #4ade80; font-size: 18px; font-weight: 800; letter-spacing: -0.01em;">Chatify</td>
                </tr>
              </table>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; line-height: 1.3; font-weight: 700;">Reset your password</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 32px;">
              <p style="margin: 0 0 20px; color: #9ca3af; font-size: 15px; line-height: 1.6;">
                Use the code below to reset your Chatify password. This code expires in 5 minutes.
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 24px;">
                    <p style="margin: 0 0 8px; color: #9ca3af; font-size: 12px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase;">Reset code</p>
                    <p style="margin: 0; color: #4ade80; font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; font-size: 38px; line-height: 1.2; font-weight: 700; letter-spacing: 10px; font-variant-numeric: tabular-nums; white-space: nowrap;">${resetCode}</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 12px; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                Do not share this code. Chatify support will never ask for it.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                If you did not request a password reset, you can ignore this email. Your password will not change unless this code is used.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px 28px; border-top: 1px solid #1f2937;">
              <p style="margin: 0 0 6px; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                This is an automated security email. Please do not reply.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                &copy; ${currentYear} Chatify. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`}
