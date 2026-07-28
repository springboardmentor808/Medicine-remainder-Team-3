import os
from twilio.rest import Client as TwilioClient
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "AC_placeholder")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "token_placeholder")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "+1234567890")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "SG_placeholder")

def send_sms_reminder(to_phone: str, medicine_name: str, dosage: str) -> dict:
    """
    Sends SMS reminder via Twilio API.
    """
    if TWILIO_ACCOUNT_SID.startswith("AC_placeholder"):
        return {"status": "simulated", "message": f"SMS reminder simulated for {to_phone}: Take {medicine_name} ({dosage})"}

    try:
        client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            body=f"⏰ Reminder: Time to take your medicine {medicine_name} ({dosage}).",
            from_=TWILIO_PHONE_NUMBER,
            to=to_phone
        )
        return {"status": "sent", "sid": msg.sid}
    except Exception as e:
        return {"status": "error", "error": str(e)}

def send_email_reminder(to_email: str, medicine_name: str, dosage: str) -> dict:
    """
    Sends Email reminder via SendGrid API.
    """
    if SENDGRID_API_KEY.startswith("SG_placeholder"):
        return {"status": "simulated", "message": f"Email reminder simulated for {to_email}: Take {medicine_name} ({dosage})"}

    try:
        message = Mail(
            from_email="no-reply@medremind.ai",
            to_emails=to_email,
            subject=f"Medication Reminder: {medicine_name}",
            html_content=f"<strong>Please take {medicine_name} ({dosage}) now.</strong>"
        )
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        return {"status": "sent", "code": response.status_code}
    except Exception as e:
        return {"status": "error", "error": str(e)}
