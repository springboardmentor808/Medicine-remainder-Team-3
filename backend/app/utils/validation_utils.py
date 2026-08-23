"""
PillSync — Validation Utilities.

Disposable email blacklist, fake phone number detection,
and optional DNS MX record verification.
"""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Disposable / Temporary Email Domain Blacklist
# ---------------------------------------------------------------------------

DISPOSABLE_EMAIL_DOMAINS: set[str] = {
    # Popular disposable/temp mail services
    "tempmail.com", "temp-mail.org", "10minutemail.com", "guerrillamail.com",
    "guerrillamail.info", "guerrillamail.net", "guerrillamail.org",
    "mailinator.com", "trashmail.com", "trashmail.net", "trashmail.org",
    "throwaway.email", "fakeinbox.com", "sharklasers.com", "guerrillamailblock.com",
    "grr.la", "dispostable.com", "yopmail.com", "yopmail.fr", "yopmail.net",
    "mailnesia.com", "maildrop.cc", "discard.email", "discardmail.com",
    "disposableemailaddresses.emailmiser.com", "emailondeck.com",
    "getnada.com", "harakirimail.com", "mailcatch.com", "mailexpire.com",
    "mailforspam.com", "safetymail.info", "spam4.me", "spamgourmet.com",
    "tempail.com", "tempmailaddress.com", "tmpmail.net", "tmpmail.org",
    "mohmal.com", "burner.kiwi", "minutemail.com", "emailfake.com",
    "crazymailing.com", "armyspy.com", "dayrep.com", "einrot.com",
    "fleckens.hu", "gustr.com", "jourrapide.com", "rhyta.com",
    "superrito.com", "teleworm.us", "tafmail.com", "mailnator.com",
    "inboxkitten.com", "tempinbox.com", "spambox.us", "mytrashmail.com",
    "thankyou2010.com", "trash-mail.at", "trashymail.com", "wegwerfmail.de",
    "wegwerfmail.net", "wh4f.org", "mailzilla.com", "nomail.xl.cx",
    "mailsucker.net", "binkmail.com", "bobmail.info", "chammy.info",
    "devnullmail.com", "emailigo.de", "emailisvalid.com", "emailthe.net",
    "emailwarden.com", "enterto.com", "example.com", "fasttrackit.net",
    "fiifke.de", "filzmail.com", "fixmail.tk", "frapmail.com",
    "getairmail.com", "getonemail.com", "getonemail.net", "girlsundertheinfluence.com",
    "gishpuppy.com", "great-host.in", "greensloth.com", "gsrv.co.uk",
    "haltospam.com", "hatespam.org", "hidemail.de", "hidzz.com",
    "hotpop.com", "imails.info", "inboxalias.com", "incognitomail.com",
    "incognitomail.net", "incognitomail.org", "jetable.fr.nf", "jetable.net",
    "jetable.org", "jnxjn.com", "kasmail.com", "koszmail.pl",
    "kurzepost.de", "lifebyfood.com", "link2mail.net", "litedrop.com",
    "lol.ovpn.to", "lookugly.com", "lr78.com", "maileater.com",
    "mailexpire.com", "mailfreeonline.com", "mailimate.com", "mailin8r.com",
    "mailismagic.com", "mailme.ir", "mailme.lv", "mailmetrash.com",
    "mailmoat.com", "mailms.com", "mailnull.com", "mailorg.org",
    "mailsac.com", "mailscrap.com", "mailshell.com", "mailsiphon.com",
    "mailslite.com", "mailtemp.info", "mailtothis.com", "mailzilla.org",
}


def is_disposable_email(email: str) -> bool:
    """
    Check if an email address uses a known disposable/temporary domain.

    Args:
        email: The email address to verify.

    Returns:
        True if the domain is a known disposable email provider.
    """
    if not email or "@" not in email:
        return False

    domain = email.rsplit("@", 1)[1].lower().strip()
    return domain in DISPOSABLE_EMAIL_DOMAINS


# ---------------------------------------------------------------------------
# Fake Phone Number Detection
# ---------------------------------------------------------------------------

FAKE_PHONE_PATTERNS: set[str] = {
    "0000000000", "1111111111", "2222222222", "3333333333",
    "4444444444", "5555555555", "6666666666", "7777777777",
    "8888888888", "9999999999", "1234567890", "0987654321",
    "1234512345", "0000000", "1111111", "9999999",
    "0123456789", "9876543210",
}


def is_fake_phone(phone: str) -> bool:
    """
    Detect obviously fake/bogus phone numbers.

    Args:
        phone: The phone number string (may include +, spaces, dashes).

    Returns:
        True if the phone matches a known fake pattern.
    """
    if not phone:
        return False

    # Strip to digits only
    digits = re.sub(r"[^\d]", "", phone)

    if len(digits) < 7 or len(digits) > 15:
        return True  # Too short or too long

    # Check against known fake patterns
    if digits in FAKE_PHONE_PATTERNS:
        return True

    # All same digit (e.g. 00000000000 of any length)
    if len(set(digits)) == 1:
        return True

    return False


def sanitize_phone(phone: str) -> str:
    """
    Remove non-numeric characters except leading '+'.

    Args:
        phone: Raw phone input.

    Returns:
        Cleaned phone string with only digits and optional leading +.
    """
    if not phone:
        return ""

    # Preserve leading +
    has_plus = phone.strip().startswith("+")
    digits = re.sub(r"[^\d]", "", phone)
    return ("+" + digits) if has_plus else digits


# ---------------------------------------------------------------------------
# DNS MX Record Check (Optional — requires dnspython)
# ---------------------------------------------------------------------------

async def has_valid_mx_record(email: str) -> bool:
    """
    Check if the email domain has valid MX (mail exchanger) DNS records.

    Requires 'dnspython' package. Returns True if package is not installed
    (graceful fallback — does not block registration).

    Args:
        email: The email address to check.

    Returns:
        True if MX records exist or check cannot be performed.
    """
    if not email or "@" not in email:
        return False

    domain = email.rsplit("@", 1)[1].lower().strip()

    try:
        import dns.resolver  # type: ignore
        answers = dns.resolver.resolve(domain, "MX")
        return len(answers) > 0
    except ImportError:
        # dnspython not installed — skip MX check
        logger.debug("[Validation] dnspython not installed, skipping MX check")
        return True
    except Exception:
        # DNS resolution failed — domain likely invalid
        return False
