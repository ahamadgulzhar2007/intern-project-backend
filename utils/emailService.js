import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOverloadEmail = async (email, deviceId, readings) => {
  if (!email || !process.env.RESEND_API_KEY) return;
  
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  
  const html = `
  <div style="font-family:'Segoe UI',sans-serif;max-width:620px;margin:0 auto;background:#0f111a;color:#f3f4f6;border-radius:16px;overflow:hidden;border:1px solid #1f2028;">
    <div style="background:linear-gradient(135deg,#7c3aed 0%,#dc2626 100%);padding:28px 32px;">
      <h1 style="margin:0;font-size:22px;color:#fff;font-weight:700;">⚡ Smart Energy Monitoring</h1>
      <p style="margin:6px 0 0;font-size:15px;color:#fecaca;font-weight:500;">⚠️ OVERLOAD DETECTED on ${deviceId}</p>
    </div>
    <div style="padding:32px;">
      <div style="background:#1f1515;border:1px solid #dc262650;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Protection Action</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#f87171;">🔴 Relay automatically disconnected to protect equipment.</p>
      </div>
      <p style="margin:0 0 12px;font-size:12px;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Measured Values at Alert Time</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
        <tr style="background:#1f2028;">
          <td style="padding:10px 14px;color:#9ca3af;border-bottom:1px solid #374151;">AC Voltage</td>
          <td style="padding:10px 14px;color:#fff;border-bottom:1px solid #374151;text-align:right;font-weight:600;">${(readings.ac?.voltage??0).toFixed(1)} V</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#9ca3af;border-bottom:1px solid #374151;">AC Current</td>
          <td style="padding:10px 14px;color:#f87171;border-bottom:1px solid #374151;text-align:right;font-weight:700;">${(readings.ac?.current??0).toFixed(2)} A</td>
        </tr>
        <tr style="background:#1f2028;">
          <td style="padding:10px 14px;color:#9ca3af;border-bottom:1px solid #374151;">DC Voltage</td>
          <td style="padding:10px 14px;color:#fff;border-bottom:1px solid #374151;text-align:right;font-weight:600;">${(readings.dc?.voltage??0).toFixed(2)} V</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#9ca3af;border-bottom:1px solid #374151;">DC Current</td>
          <td style="padding:10px 14px;color:#fff;border-bottom:1px solid #374151;text-align:right;font-weight:600;">${(readings.dc?.current??0).toFixed(2)} A</td>
        </tr>
      </table>
      <div style="background:#1f2028;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;"><span style="color:#9ca3af;font-weight:600;">Device ID:</span> ${deviceId}</p>
        <p style="margin:0;font-size:13px;color:#6b7280;"><span style="color:#9ca3af;font-weight:600;">Time (IST):</span> ${time}</p>
      </div>
    </div>
  </div>`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Smart Energy <onboarding@resend.dev>',
      to: email,
      subject: `⚠️ Smart Energy Alert — Overload on ${deviceId}`,
      html: html,
    });
    if (error) console.error("EmailJS/Resend Error:", error);
    return data;
  } catch (err) {
    console.error("Failed to send email:", err.message);
  }
};
