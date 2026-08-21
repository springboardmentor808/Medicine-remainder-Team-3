"""
PillSync Email Service.

Sends styled HTML emails for OTP verification, welcome messages,
and password reset links using aiosmtplib (async SMTP, free).
Falls back to console logging if SMTP is not configured.
"""

import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

# Lazy import — aiosmtplib may not be installed
_HAS_AIOSMTPLIB = False
try:
    import aiosmtplib
    _HAS_AIOSMTPLIB = True
except ImportError:
    logger.warning("[Email Service] aiosmtplib not installed — emails will be logged to console only.")


def _is_smtp_configured() -> bool:
    """Check if SMTP credentials are set."""
    from app.core.config import settings
    return bool(settings.SMTP_USER and settings.SMTP_PASSWORD and _HAS_AIOSMTPLIB)


# ---------------------------------------------------------------------------
# HTML Email Templates
# ---------------------------------------------------------------------------

def _otp_email_html(otp_code: str, purpose: str = "verification") -> str:
    """Generate styled HTML for OTP email."""
    purpose_text = {
        "verification": "verify your email address",
        "password_reset": "reset your password",
        "login": "log in to your account",
    }.get(purpose, "complete your request")

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body {{ margin:0; padding:0; background:#f0f4f8; font-family:'Inter','Segoe UI',sans-serif; }}
  .container {{ max-width:480px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }}
  .header {{ background:linear-gradient(135deg,#006a4e 0%,#00897b 100%); padding:32px 24px; text-align:center; }}
  .header h1 {{ color:#ffffff; font-size:24px; margin:0 0 4px; font-weight:700; }}
  .header p {{ color:rgba(255,255,255,0.85); font-size:14px; margin:0; }}
  .body {{ padding:32px 24px; }}
  .otp-box {{ background:linear-gradient(135deg,#e8f5e9,#f1f8e9); border:2px dashed #43a047; border-radius:12px; padding:24px; text-align:center; margin:24px 0; }}
  .otp-code {{ font-size:36px; letter-spacing:8px; font-weight:800; color:#2e7d32; font-family:'Courier New',monospace; }}
  .info {{ color:#546e7a; font-size:14px; line-height:1.6; }}
  .warning {{ background:#fff3e0; border-left:4px solid #ff9800; padding:12px 16px; border-radius:0 8px 8px 0; margin:16px 0; font-size:13px; color:#e65100; }}
  .footer {{ background:#f5f7fa; padding:20px 24px; text-align:center; font-size:12px; color:#90a4ae; }}
</style></head>
<body>
<div class="container">
  <div class="header">
    <div style="font-size:32px;">&#128138;</div>
    <h1>PillSync</h1>
    <p>AI Medicine Reminder &amp; Tracker</p>
  </div>
  <div class="body">
    <p class="info">Hello! Use the OTP code below to <strong>{purpose_text}</strong>:</p>
    <div class="otp-box">
      <div class="otp-code">{otp_code}</div>
      <p style="margin:8px 0 0; color:#558b2f; font-size:13px; font-weight:600;">Valid for 10 minutes</p>
    </div>
    <div class="warning">
      &#9888;&#65039; Never share this code with anyone. PillSync team will never ask for your OTP.
    </div>
    <p class="info">If you didn't request this, please ignore this email.</p>
  </div>
  <div class="footer">
    &copy; 2026 PillSync &mdash; Intelligent Medicine Management<br>
    This is an automated email. Please do not reply.
  </div>
</div>
</body></html>"""


def _password_reset_link_html(reset_link: str) -> str:
    """Generate styled HTML for password reset link email."""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body {{ margin:0; padding:0; background:#f0f4f8; font-family:'Inter','Segoe UI',sans-serif; }}
  .container {{ max-width:480px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }}
  .header {{ background:linear-gradient(135deg,#006a4e 0%,#00897b 100%); padding:32px 24px; text-align:center; }}
  .header h1 {{ color:#ffffff; font-size:24px; margin:0 0 4px; font-weight:700; }}
  .header p {{ color:rgba(255,255,255,0.85); font-size:14px; margin:0; }}
  .body {{ padding:32px 24px; }}
  .btn {{ display:inline-block; background:linear-gradient(135deg,#006a4e,#00897b); color:#ffffff !important; text-decoration:none; padding:14px 32px; border-radius:8px; font-weight:700; font-size:16px; margin:20px 0; }}
  .info {{ color:#546e7a; font-size:14px; line-height:1.6; }}
  .link-box {{ background:#f5f7fa; padding:12px; border-radius:8px; word-break:break-all; font-size:12px; color:#607d8b; margin:16px 0; }}
  .warning {{ background:#fff3e0; border-left:4px solid #ff9800; padding:12px 16px; border-radius:0 8px 8px 0; margin:16px 0; font-size:13px; color:#e65100; }}
  .footer {{ background:#f5f7fa; padding:20px 24px; text-align:center; font-size:12px; color:#90a4ae; }}
</style></head>
<body>
<div class="container">
  <div class="header">
    <div style="font-size:32px;">&#128272;</div>
    <h1>PillSync</h1>
    <p>Password Reset Request</p>
  </div>
  <div class="body">
    <p class="info">We received a request to reset your password. Click the button below to set a new password:</p>
    <div style="text-align:center;">
      <a href="{reset_link}" class="btn">Reset My Password</a>
    </div>
    <p class="info" style="font-size:12px; margin-top:8px;">Or copy and paste this link in your browser:</p>
    <div class="link-box">{reset_link}</div>
    <div class="warning">
      &#9888;&#65039; This link expires in 10 minutes. If you didn't request a password reset, ignore this email.
    </div>
  </div>
  <div class="footer">
    &copy; 2026 PillSync &mdash; Intelligent Medicine Management<br>
    This is an automated email. Please do not reply.
  </div>
</div>
</body></html>"""


def _welcome_email_html(user_name: str) -> str:
    """Generate styled HTML for welcome email."""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body {{ margin:0; padding:0; background:#f0f4f8; font-family:'Inter','Segoe UI',sans-serif; }}
  .container {{ max-width:480px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }}
  .header {{ background:linear-gradient(135deg,#006a4e 0%,#00897b 100%); padding:32px 24px; text-align:center; }}
  .header h1 {{ color:#ffffff; font-size:24px; margin:0 0 4px; font-weight:700; }}
  .body {{ padding:32px 24px; }}
  .info {{ color:#546e7a; font-size:14px; line-height:1.8; }}
  .feature {{ display:flex; align-items:flex-start; gap:12px; margin:12px 0; }}
  .feature-icon {{ font-size:20px; flex-shrink:0; margin-top:2px; }}
  .footer {{ background:#f5f7fa; padding:20px 24px; text-align:center; font-size:12px; color:#90a4ae; }}
</style></head>
<body>
<div class="container">
  <div class="header">
    <div style="font-size:32px;">&#127881;</div>
    <h1>Welcome to PillSync!</h1>
  </div>
  <div class="body">
    <p class="info">Hi <strong>{user_name}</strong>,</p>
    <p class="info">Your PillSync account has been created successfully! Here's what you can do:</p>
    <div class="feature"><span class="feature-icon">&#128138;</span><span class="info"><strong>Track Medicines</strong> &mdash; Add and manage your medication inventory</span></div>
    <div class="feature"><span class="feature-icon">&#9200;</span><span class="info"><strong>Smart Reminders</strong> &mdash; Never miss a dose with AI-powered alerts</span></div>
    <div class="feature"><span class="feature-icon">&#128247;</span><span class="info"><strong>OCR Scanner</strong> &mdash; Scan prescriptions with your camera</span></div>
    <div class="feature"><span class="feature-icon">&#128202;</span><span class="info"><strong>Adherence Analytics</strong> &mdash; Track your medication compliance</span></div>
    <p class="info" style="margin-top:20px;">Start by adding your first medicine from your dashboard.</p>
  </div>
  <div class="footer">
    &copy; 2026 PillSync &mdash; Intelligent Medicine Management
  </div>
</div>
</body></html>"""


# ---------------------------------------------------------------------------
# Core Send Functions
# ---------------------------------------------------------------------------

async def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """
    Send an HTML email via SMTP. Returns True on success, False on failure.
    Falls back to console logging if SMTP is not configured.
    """
    from app.core.config import settings

    if not _is_smtp_configured():
        logger.info(f"[Email Service] SMTP not configured. Email to {to_email} logged only.")
        logger.info(f"[Email Service] Subject: {subject}")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=settings.SMTP_USE_TLS,
        )
        logger.info(f"[Email Service] Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"[Email Service] Failed to send email to {to_email}: {e}")
        return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def send_otp_email(to_email: str, otp_code: str, purpose: str = "verification") -> bool:
    """Send OTP verification email."""
    subject_map = {
        "verification": "PillSync — Your Verification Code",
        "password_reset": "PillSync — Password Reset Code",
        "login": "PillSync — Login Verification Code",
    }
    subject = subject_map.get(purpose, "PillSync — Your OTP Code")
    html = _otp_email_html(otp_code, purpose)

    sent = await _send_email(to_email, subject, html)
    if not sent:
        # Console fallback
        print(f"\n{'='*55}\n[PillSync OTP] Code for {to_email}: {otp_code}\n{'='*55}\n")
    return sent


async def send_password_reset_link(to_email: str, reset_token: str) -> bool:
    """Send password reset link email."""
    from app.core.config import settings
    reset_link = f"{settings.FRONTEND_URL}/forgot-password?token={reset_token}&email={to_email}"
    html = _password_reset_link_html(reset_link)
    sent = await _send_email(to_email, "PillSync — Reset Your Password", html)
    if not sent:
        print(f"\n{'='*55}\n[PillSync] Password Reset Link: {reset_link}\n{'='*55}\n")
    return sent


async def send_welcome_email(to_email: str, user_name: str) -> bool:
    """Send welcome email after registration."""
    html = _welcome_email_html(user_name)
    return await _send_email(to_email, "Welcome to PillSync!", html)
