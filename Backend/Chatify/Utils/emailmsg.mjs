export const HTMLTemplate = function (resetCode) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #000000;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                
                <!-- Main Container -->
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #1a1f2e; border-radius: 24px; max-width: 600px;">
                    
                    <!-- Header -->
                    <tr>
                        <td align="center" style="padding: 50px 40px 40px; background-color: #151a24;">
                            
                            <!-- Lock Icon Box -->
                            <table border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center" style="width: 90px; height: 90px; background-color: #00ff00; border-radius: 20px; font-size: 50px; line-height: 90px;">
                                        🔒
                                    </td>
                                </tr>
                            </table>
                            
                            <h1 style="margin: 30px 0 12px; color: #ffffff; font-size: 32px; font-weight: bold;">Password Reset Request</h1>
                            <p style="margin: 0; color: #94a3b8; font-size: 16px;">Secure verification code for your account</p>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 30px 40px 40px;">
                            
                            <p style="color: #cbd5e1; font-size: 16px; line-height: 1.7; margin: 0 0 30px;">
                                We received a request to reset your password. Use the verification code below to complete the process:
                            </p>

                            <!-- Code Box -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center" style="background-color: #0f172a; padding: 45px 30px; border-radius: 16px; border: 2px solid #22c55e;">
                                        <p style="text-align: center; color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 20px;">VERIFICATION CODE</p>
                                        <p style="text-align: center; color: #00ff00; letter-spacing: 18px; margin: 0; font-size: 52px; font-weight: bold; font-family: 'Courier New', monospace;">${resetCode}</p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Warning Box -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 25px 0;">
                                <tr>
                                    <td style="background-color: #1a2f1f; border: 2px solid #22c55e; border-left: 4px solid #00ff00; padding: 20px; border-radius: 12px;">
                                        <table border="0" cellspacing="0" cellpadding="0" width="100%">
                                            <tr>
                                                <td width="40" valign="top" style="font-size: 24px; line-height: 1;">
                                                    ⏱️
                                                </td>
                                                <td style="color: #cbd5e1; font-size: 14px; line-height: 1.7;">
                                                    <span style="color: #00ff00; font-weight: bold;">Time Sensitive:</span> This code will expire in <strong style="color: #ffffff;">5 minutes</strong> for your security.
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Security Box -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 25px 0;">
                                <tr>
                                    <td style="background-color: #1e293b; border: 2px solid #475569; padding: 20px; border-radius: 12px;">
                                        <table border="0" cellspacing="0" cellpadding="0" width="100%">
                                            <tr>
                                                <td width="40" valign="top" style="font-size: 24px; line-height: 1;">
                                                    🔐
                                                </td>
                                                <td style="color: #94a3b8; font-size: 14px; line-height: 1.7;">
                                                    <span style="color: #cbd5e1; font-weight: bold;">Security Notice:</span> Never share this code with anyone. Our team will never ask for it.
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Additional Security Tips -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 25px 0;">
                                <tr>
                                    <td style="background-color: #0f1419; border: 1px solid #334155; padding: 20px; border-radius: 12px;">
                                        <table border="0" cellspacing="0" cellpadding="0" width="100%">
                                            <tr>
                                                <td width="40" valign="top" style="font-size: 24px; line-height: 1;">
                                                    ⚠️
                                                </td>
                                                <td style="color: #94a3b8; font-size: 14px; line-height: 1.7;">
                                                    <span style="color: #cbd5e1; font-weight: bold;">Didn't request this?</span> If you didn't request a password reset, please ignore this email or contact our support team immediately.
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Divider -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 40px 0 30px;">
                                <tr>
                                    <td style="height: 1px; background-color: #22c55e;"></td>
                                </tr>
                            </table>

                            <p style="color: #475569; font-size: 12px; text-align: center; margin: 0;">
                                This is an automated security message — please do not reply
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="background-color: #0f1419; padding: 30px 40px; border-top: 1px solid #22c55e;">
                            <p style="margin: 0 0 8px; color: #64748b; font-size: 13px; font-weight: bold;">
                                🛡️ © 2025 Chatify. All rights reserved.
                            </p>
                            <p style="margin: 0; color: #334155; font-size: 11px;">
                                Secure authentication system
                            </p>
                        </td>
                    </tr>
                    
                </table>
                
            </td>
        </tr>
    </table>
</body>
</html>`}