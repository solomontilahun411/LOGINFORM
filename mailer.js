const nodemailer = require("nodemailer");
require("dotenv").config();

/**
 * Creates and returns the nodemailer transporter.
 * Uses Gmail SMTP with App Passwords by default.
 */
function createTransporter() {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    return null;
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: emailUser,
      pass: emailPass.replace(/\s+/g, ""), // Remove spaces if user pasted 4x4 app password format
    },
  });
}

/**
 * Generates modern, rich HTML template for password reset OTP email
 */
function getOtpEmailHtml(username, otp) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset OTP</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0d1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e6edf3;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0d1117; padding: 40px 15px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width: 540px; background: linear-gradient(145deg, #161b22, #0f141c); border: 1px solid rgba(88, 166, 255, 0.25); border-radius: 18px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
            
            <!-- Header Brand -->
            <tr>
              <td style="padding: 32px 30px 20px 30px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <div style="display: inline-block; padding: 10px 18px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 30px; margin-bottom: 12px;">
                  <span style="font-size: 13px; font-weight: 700; letter-spacing: 1.5px; color: #38bdf8; text-transform: uppercase;">🛡️ SOLOMON DEV SECURITY</span>
                </div>
                <h1 style="margin: 10px 0 0 0; font-size: 24px; font-weight: 700; color: #ffffff;">Password Reset Request</h1>
                <p style="margin: 6px 0 0 0; font-size: 14px; color: #8b949e;">የይለፍ ቃል መቀየሪያ ማረጋገጫ ኮድ</p>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td style="padding: 30px 30px 20px 30px;">
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #c9d1d9;">
                  ሰላም <strong>${username}</strong>,
                </p>
                <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #8b949e;">
                  የአካውንትዎን የይለፍ ቃል ለመቀየር ጥያቄ አቅርበዋል። ይህንን ጥያቄ ያቀረቡት እርስዎ ከሆኑ የሚከተለውን <strong>የ 6-አሃዝ OTP ኮድ</strong> ይጠቀሙ፦
                </p>

                <!-- OTP Code Display Card -->
                <div style="background: rgba(13, 17, 23, 0.8); border: 2px dashed #38bdf8; border-radius: 14px; padding: 24px; text-align: center; margin: 25px 0;">
                  <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #8b949e; margin-bottom: 8px;">
                    የእርስዎ OTP ኮድ (YOUR OTP CODE)
                  </div>
                  <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; text-shadow: 0 0 15px rgba(56, 189, 248, 0.4);">
                    ${otp}
                  </div>
                  <div style="font-size: 13px; color: #f87171; margin-top: 10px; font-weight: 500;">
                    ⏳ ኮዱ የሚያበቃው በ 10 ደቂቃ ውስጥ ነው (Valid for 10 minutes)
                  </div>
                </div>

                <!-- Warning Notice -->
                <div style="background: rgba(239, 68, 68, 0.08); border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px; margin-top: 25px;">
                  <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #fca5a5;">
                    ⚠️ <strong>ማሳሰቢያ፦</strong> ይህንን የይለፍ ቃል መቀየር ጥያቄ እርስዎ ካልጠየቁ ይህንን ኢሜይል ችላ ይበሉት። ማንም ሰው ይህንን ኮድ እንዲያጋሩ ቢጠይቅዎት አያጋሩ።
                  </p>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 20px 30px 30px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.08);">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #6e7681;">
                  ይህ መልእክት በራስ-ሰር የተላከ ነው፤ እባክዎ በቀጥታ መልስ አይስጡ።
                </p>
                <p style="margin: 0; font-size: 12px; color: #484f58;">
                  © ${new Date().getFullYear()} Solomon Dev. All rights reserved.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

/**
 * Sends the OTP code to user's real email address.
 * Returns { success: boolean, emailSent: boolean, error?: string }
 */
async function sendOtpEmail(toEmail, username, otp) {
  const transporter = createTransporter();

  if (!transporter) {
    console.log(`\n======================================================`);
    console.log(`ℹ️ [MAILER NOTE] Real email sending is currently in DEMO mode.`);
    console.log(`To send live emails to Gmail, please set EMAIL_USER & EMAIL_PASS in .env`);
    console.log(`🔑 OTP for ${toEmail}: ${otp}`);
    console.log(`======================================================\n`);
    return {
      success: true,
      emailSent: false,
      reason: "credentials_not_configured",
    };
  }

  const senderEmail = process.env.EMAIL_USER;
  const senderName = process.env.EMAIL_FROM_NAME || "Solomon Dev Security";

  const mailOptions = {
    from: `"${senderName}" <${senderEmail}>`,
    to: toEmail,
    subject: `🔐 ${otp} የይለፍ ቃል መቀየሪያ OTP ኮድ (Password Reset Code)`,
    text: `ሰላም ${username}፣ የይለፍ ቃል መቀየሪያ ኮድዎ፦ ${otp} ነው። ኮዱ የሚያበቃው በ 10 ደቂቃ ውስጥ ነው።`,
    html: getOtpEmailHtml(username, otp),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 [MAILER] Real OTP email successfully sent to: ${toEmail} (MessageId: ${info.messageId})`);
    return {
      success: true,
      emailSent: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(`❌ [MAILER ERROR] Failed to send email to ${toEmail}:`, error.message);
    return {
      success: false,
      emailSent: false,
      error: error.message,
    };
  }
}

module.exports = {
  sendOtpEmail,
};
