const OtpTemplate = (otp:number | string , userName: string|null) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your OTP Code</title>
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: #f4f7fa;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td align="center" style="background: linear-gradient(90deg, #2563eb, #3b82f6); padding: 20px;">
              <h1 style="margin: 0; font-size: 28px; color: #ffffff;">Hybritech</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 30px; color: #333333;">
              <h2 style="margin-top: 0;">Your One-Time Password</h2>
              <p style="font-size: 15px; line-height: 1.5;">
                Hello ${userName},<br/>  
                Use the following OTP to complete your verification with <strong>Hybritech</strong>.  
                This code will expire in <strong>10 minutes</strong> for security reasons.
              </p>

              <!-- OTP Code Box -->
              <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; padding: 14px 28px; font-size: 24px; font-weight: bold; color: #2563eb; background-color: #f0f4ff; border-radius: 8px; border: 1px solid #c7d2fe; letter-spacing: 4px;">
                  ${otp}
                </div>
              </div>

              <p style="font-size: 14px; color: #555;">
                If you didn’t request this code, please ignore this email or contact our support immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background: #f9fafb; padding: 15px; font-size: 12px; color: #888;">
              &copy; ${new Date().getFullYear()} Hybritech. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
export {OtpTemplate};