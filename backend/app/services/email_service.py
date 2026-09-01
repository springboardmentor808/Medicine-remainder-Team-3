"""
PillSync Zero-Cost Email & Medical Report PDF Dispatch Engine.

Sends responsive, professional HTML emails and dynamic PDF report attachments
using aiosmtplib (async SMTP) and ReportLab. Supports Gmail App Passwords,
self-hosted Postfix, or standard SMTP relays with zero SaaS subscriptions.
"""

import io
import asyncio
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional, List, Dict, Any
from datetime import datetime

import aiosmtplib
from jinja2 import Template

from app.core.config import settings


# ===================================================================
# Responsive HTML Email Templates
# ===================================================================

OTP_EMAIL_TEMPLATE = Template("""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #0f172a; color: #f8fafc; }
    .container { max-width: 540px; margin: 30px auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; }
    .header { background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 28px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 32px 28px; text-align: center; }
    .badge { display: inline-block; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #10b981; background: #0f172a; border: 2px solid #059669; padding: 12px 28px; border-radius: 12px; margin: 24px 0; font-family: monospace; }
    .notice { font-size: 13px; color: #94a3b8; line-height: 1.6; }
    .warning { color: #f59e0b; font-size: 12px; margin-top: 16px; }
    .footer { border-top: 1px solid #334155; padding: 20px; text-align: center; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💊 PillSync AI Healthcare</h1>
    </div>
    <div class="content">
      <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">{{ title }}</h2>
      <p style="color: #cbd5e1; font-size: 14px;">Use the verification code below to complete your authentication request:</p>
      
      <div class="badge">{{ otp_code }}</div>
      
      <p class="notice">This code is cryptographically protected and will expire in <strong>5 minutes</strong>.<br>If you did not request this code, please ignore this email.</p>
      <p class="warning">⚠️ Never share your verification code with anyone.</p>
    </div>
    <div class="footer">
      &copy; {{ year }} PillSync Healthcare Ecosystem &bull; Intelligent Medication Management
    </div>
  </div>
</body>
</html>
""")


WELCOME_EMAIL_TEMPLATE = Template("""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #0f172a; color: #f8fafc; }
    .container { max-width: 540px; margin: 30px auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; }
    .header { background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 32px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 26px; }
    .content { padding: 32px 28px; }
    .btn { display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px; margin: 20px 0; }
    .feature-list { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 16px 20px; margin: 20px 0; font-size: 13px; color: #cbd5e1; }
    .feature-list li { margin-bottom: 8px; }
    .footer { border-top: 1px solid #334155; padding: 20px; text-align: center; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to PillSync! 👋</h1>
    </div>
    <div class="content">
      <h2 style="color: #ffffff; font-size: 18px;">Hello, {{ full_name }}!</h2>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">Your {{ role | title }} account has been successfully initialized. PillSync brings intelligent clinical safety, pediatric dosage guards, and smart refill forecasting to your daily healthcare.</p>
      
      <div class="feature-list">
        <strong>What you can do with PillSync:</strong>
        <ul style="padding-left: 20px; margin-top: 8px;">
          <li>📸 <strong>AI Prescription Scanner:</strong> Upload doctor prescriptions for automatic OCR extraction.</li>
          <li>⏰ <strong>Smart Reminders:</strong> Schedule recurring morning/afternoon/night doses.</li>
          <li>🛡️ <strong>DDI Interaction Matrix:</strong> Real-time drug-drug interaction contraindication alerts.</li>
          <li>📈 <strong>Quantile Refill Forecasting:</strong> AI-predicted runout dates and inventory depletion tracking.</li>
        </ul>
      </div>

      <div style="text-align: center;">
        <a href="{{ login_url }}" class="btn" style="color: #ffffff;">Launch Your Dashboard →</a>
      </div>
    </div>
    <div class="footer">
      PillSync Healthcare &bull; Privacy-Preserving Self-Hosted Clinical AI
    </div>
  </div>
</body>
</html>
""")


PASSWORD_RESET_TEMPLATE = Template("""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #0f172a; color: #f8fafc; }
    .container { max-width: 540px; margin: 30px auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; }
    .header { background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); padding: 28px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 24px; }
    .content { padding: 32px 28px; text-align: center; }
    .btn { display: inline-block; background-color: #e11d48; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px; margin: 24px 0; }
    .notice { font-size: 12px; color: #94a3b8; line-height: 1.6; }
    .footer { border-top: 1px solid #334155; padding: 20px; text-align: center; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Password Reset Request</h1>
    </div>
    <div class="content">
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">We received a request to reset the password for your PillSync account. Click the secure button below to choose a new password:</p>
      
      <div>
        <a href="{{ reset_url }}" class="btn" style="color: #ffffff;">Reset My Password</a>
      </div>

      <p class="notice">This single-use link is valid for <strong>15 minutes</strong>.<br>If you did not request a password reset, no action is needed — your account remains completely secure.</p>
    </div>
    <div class="footer">
      PillSync Security Team &bull; Encrypted Authentication
    </div>
  </div>
</body>
</html>
""")


# ===================================================================
# Asynchronous Email Dispatcher
# ===================================================================

class EmailService:
    """Async Email Dispatch Service supporting zero-cost SMTP."""

    @classmethod
    async def _send_mime_email(
        cls,
        to_email: str,
        subject: str,
        html_body: str,
        attachment_bytes: Optional[bytes] = None,
        attachment_filename: Optional[str] = None,
    ) -> bool:
        """Core async SMTP transport."""
        msg = MIMEMultipart("mixed")
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL or 'noreply@pillsync.app'}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        # HTML body
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        # Optional PDF Attachment
        if attachment_bytes and attachment_filename:
            part = MIMEApplication(attachment_bytes, Name=attachment_filename)
            part["Content-Disposition"] = f'attachment; filename="{attachment_filename}"'
            msg.attach(part)

        # In local/offline mode without configured SMTP credentials, simulate successfully
        if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            print(f"[EmailService MOCK] Dispatched email to {to_email} | Subject: '{subject}'")
            return True

        try:
            await aiosmtplib.send(
                msg,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                start_tls=settings.SMTP_USE_TLS,
                timeout=15.0,
            )
            return True
        except Exception as err:
            print(f"[EmailService Error] Failed to send email to {to_email}: {err}")
            return False

    @classmethod
    async def send_otp_email(cls, to_email: str, otp_code: str, purpose: str = "VERIFICATION") -> bool:
        """Send a 6-digit OTP verification email."""
        title = "Verify Your PillSync Account" if purpose == "VERIFY" else "Password Reset Verification Code"
        html = OTP_EMAIL_TEMPLATE.render(
            title=title,
            otp_code=otp_code,
            year=datetime.now().year,
        )
        return await cls._send_mime_email(
            to_email=to_email,
            subject=f"💊 Your PillSync Security Code: {otp_code}",
            html_body=html,
        )

    @classmethod
    async def send_welcome_email(cls, to_email: str, full_name: str, role: str) -> bool:
        """Send a personalized welcome onboarding email."""
        html = WELCOME_EMAIL_TEMPLATE.render(
            full_name=full_name,
            role=role,
            login_url=f"{settings.FRONTEND_URL}/login",
        )
        return await cls._send_mime_email(
            to_email=to_email,
            subject="👋 Welcome to PillSync AI Healthcare!",
            html_body=html,
        )

    @classmethod
    async def send_password_reset_email(cls, to_email: str, reset_token: str) -> bool:
        """Send a single-use password reset email."""
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
        html = PASSWORD_RESET_TEMPLATE.render(reset_url=reset_url)
        return await cls._send_mime_email(
            to_email=to_email,
            subject="🔐 PillSync Password Reset Request",
            html_body=html,
        )

    @classmethod
    def generate_medical_report_pdf(
        cls,
        patient_name: str,
        adherence_percentage: float,
        medicines: List[Dict[str, Any]],
        start_date: str,
        end_date: str,
    ) -> bytes:
        """
        Generate a styled medication adherence PDF report in-memory.
        Uses ReportLab if available, or produces a valid formatted PDF stream.
        """
        try:
            from reportlab.lib import colors  # type: ignore
            from reportlab.lib.pagesizes import letter  # type: ignore
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle  # type: ignore
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle  # type: ignore

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
            elements = []
            styles = getSampleStyleSheet()

            # Header
            title_style = ParagraphStyle(
                'ReportTitle',
                parent=styles['Heading1'],
                fontSize=20,
                textColor=colors.HexColor('#059669'),
                spaceAfter=6,
            )
            elements.append(Paragraph("💊 PillSync AI Healthcare — Medication Adherence Report", title_style))
            elements.append(Paragraph(f"<b>Patient:</b> {patient_name} | <b>Period:</b> {start_date} to {end_date}", styles['Normal']))
            elements.append(Paragraph(f"<b>Overall Adherence Score:</b> {adherence_percentage:.1f}%", styles['Normal']))
            elements.append(Spacer(1, 16))

            # Table Data
            table_data = [["Medicine Name", "Dosage", "Daily Frequency", "Stock Left", "Refill Status"]]
            for med in medicines:
                table_data.append([
                    med.get("name", "N/A"),
                    med.get("dosage", "N/A"),
                    str(med.get("daily_frequency", "1")),
                    str(med.get("current_stock", "0")),
                    "Low Stock" if med.get("current_stock", 0) <= 5 else "Adequate",
                ])

            t = Table(table_data, colWidths=[150, 80, 100, 80, 100])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ]))
            elements.append(t)
            elements.append(Spacer(1, 20))
            elements.append(Paragraph("<i>This report was automatically compiled by the PillSync AI Healthcare Platform.</i>", styles['Italic']))

            doc.build(elements)
            buffer.seek(0)
            return buffer.getvalue()
        except Exception:
            # Fallback minimalist PDF generator
            fallback_text = (
                f"%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
                f"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
                f"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n"
                f"4 0 obj << /Length 120 >> stream\n"
                f"BT /F1 14 Tf 50 720 Td (PillSync Medical Report: {patient_name}) Tj ET\n"
                f"endstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer << /Size 5 /Root 1 0 R >>\nstartxref\n386\n%%EOF"
            )
            return fallback_text.encode("utf-8")

    @classmethod
    async def send_medical_report_email(
        cls,
        to_email: str,
        patient_name: str,
        adherence_percentage: float,
        medicines: List[Dict[str, Any]],
        start_date: str,
        end_date: str,
    ) -> bool:
        """Generate PDF report asynchronously and dispatch via email."""
        pdf_bytes = await asyncio.to_thread(
            cls.generate_medical_report_pdf,
            patient_name=patient_name,
            adherence_percentage=adherence_percentage,
            medicines=medicines,
            start_date=start_date,
            end_date=end_date,
        )
        html = f"""
        <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
          <h2 style="color: #10b981;">Medication Adherence Report</h2>
          <p>Hello <b>{patient_name}</b>,</p>
          <p>Your periodic medication adherence report ({start_date} to {end_date}) is ready. Your overall adherence score is <strong>{adherence_percentage:.1f}%</strong>.</p>
          <p>Please find the attached PDF report for complete dosage details.</p>
          <br>
          <small style="color: #64748b;">PillSync Healthcare &bull; Clinical Intelligence</small>
        </div>
        """
        return await cls._send_mime_email(
            to_email=to_email,
            subject=f"📊 Medication Adherence Report ({start_date} - {end_date})",
            html_body=html,
            attachment_bytes=pdf_bytes,
            attachment_filename=f"PillSync_Report_{patient_name.replace(' ', '_')}.pdf",
        )
