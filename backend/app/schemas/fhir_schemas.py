"""
PillSync HL7 FHIR Schema Definitions (Track 3 -- Engineer 3).

Pydantic models representing HL7 FHIR R4 resources for medication
management, ensuring PillSync API outputs are interoperable with
global healthcare systems.

FHIR Resources implemented:
  - MedicationRequest (prescription orders)
  - MedicationStatement (patient-reported medication use)
  - Dosage (structured dosing instructions)
  - Medication (drug product definition)

HL7 FHIR R4 Standard: https://www.hl7.org/fhir/

Usage:
    from backend.app.schemas.fhir_schemas import (
        FHIRMedicationRequest,
        FHIRMedicationStatement,
    )
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ===================================================================
# FHIR Enums
# ===================================================================

class FHIRMedicationRequestStatus(str, Enum):
    """FHIR MedicationRequest status codes."""
    ACTIVE = "active"
    ON_HOLD = "on-hold"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    ENTERED_IN_ERROR = "entered-in-error"
    STOPPED = "stopped"
    DRAFT = "draft"
    UNKNOWN = "unknown"


class FHIRMedicationRequestIntent(str, Enum):
    """FHIR MedicationRequest intent codes."""
    PROPOSAL = "proposal"
    PLAN = "plan"
    ORDER = "order"
    ORIGINAL_ORDER = "original-order"
    REFLEX_ORDER = "reflex-order"
    FILLER_ORDER = "filler-order"
    INSTANCE_ORDER = "instance-order"
    OPTION = "option"


class FHIRMedicationStatementStatus(str, Enum):
    """FHIR MedicationStatement status codes."""
    ACTIVE = "active"
    COMPLETED = "completed"
    ENTERED_IN_ERROR = "entered-in-error"
    INTENDED = "intended"
    STOPPED = "stopped"
    ON_HOLD = "on-hold"
    UNKNOWN = "unknown"
    NOT_TAKEN = "not-taken"


class FHIRMedicationStatus(str, Enum):
    """FHIR Medication status codes."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ENTERED_IN_ERROR = "entered-in-error"


# ===================================================================
# FHIR Coding & Reference Primitives
# ===================================================================

class FHIRCoding(BaseModel):
    """FHIR Coding element — a code from a terminology system."""
    system: Optional[str] = Field(
        None,
        description="URI of the coding system (e.g., http://www.nlm.nih.gov/research/umls/rxnorm)",
        examples=["http://www.nlm.nih.gov/research/umls/rxnorm"],
    )
    code: Optional[str] = Field(None, description="Code value from the system")
    display: Optional[str] = Field(None, description="Human-readable representation")


class FHIRCodeableConcept(BaseModel):
    """FHIR CodeableConcept — text and/or coded concepts."""
    coding: list[FHIRCoding] = Field(default_factory=list)
    text: Optional[str] = Field(None, description="Plain text representation")


class FHIRReference(BaseModel):
    """FHIR Reference to another resource."""
    reference: Optional[str] = Field(None, description="Relative or absolute resource URI")
    display: Optional[str] = Field(None, description="Text alternative for the reference")


class FHIRQuantity(BaseModel):
    """FHIR Quantity — a measured amount."""
    value: Optional[float] = None
    unit: Optional[str] = None
    system: Optional[str] = Field(
        default="http://unitsofmeasure.org",
        description="System that defines the unit",
    )
    code: Optional[str] = Field(None, description="Coded form of the unit")


class FHIRPeriod(BaseModel):
    """FHIR Period — a time range."""
    start: Optional[datetime] = None
    end: Optional[datetime] = None


# ===================================================================
# FHIR Dosage Resource
# ===================================================================

class FHIRTimingRepeat(BaseModel):
    """FHIR Timing.repeat — when the event should occur."""
    frequency: Optional[int] = Field(None, description="Number of times per period")
    period: Optional[float] = Field(None, description="Duration of one period")
    periodUnit: Optional[str] = Field(None, description="Unit: s|min|h|d|wk|mo|a")
    when: Optional[list[str]] = Field(
        default=None,
        description="Code for time period of occurrence (e.g., MORN, AFT, EVE, NIGHT)",
    )
    timeOfDay: Optional[list[str]] = Field(
        default=None,
        description="Time of day for action (HH:MM:SS format)",
    )


class FHIRTiming(BaseModel):
    """FHIR Timing — describes event timing."""
    repeat: Optional[FHIRTimingRepeat] = None
    code: Optional[FHIRCodeableConcept] = Field(
        None,
        description="BID | TID | QID | AM | PM | etc.",
    )


class FHIRDoseAndRate(BaseModel):
    """FHIR Dosage.doseAndRate — amount of medication per dose."""
    type: Optional[FHIRCodeableConcept] = None
    doseQuantity: Optional[FHIRQuantity] = None


class FHIRDosage(BaseModel):
    """
    FHIR Dosage — structured dosing instructions.

    Maps PillSync's dosage fields (dosage, daily_frequency,
    quantity_per_dose) to FHIR-compliant format.
    """
    sequence: Optional[int] = None
    text: Optional[str] = Field(
        None,
        description="Free text dosage instructions",
        examples=["Take 1 tablet twice daily after meals"],
    )
    timing: Optional[FHIRTiming] = None
    route: Optional[FHIRCodeableConcept] = Field(
        None,
        description="Route of administration (oral, topical, etc.)",
    )
    method: Optional[FHIRCodeableConcept] = None
    doseAndRate: Optional[list[FHIRDoseAndRate]] = None
    maxDosePerDay: Optional[FHIRQuantity] = None


# ===================================================================
# FHIR Medication Resource
# ===================================================================

class FHIRIngredient(BaseModel):
    """FHIR Medication.ingredient — active ingredient component."""
    itemCodeableConcept: Optional[FHIRCodeableConcept] = None
    isActive: bool = True
    strength: Optional[FHIRQuantity] = None


class FHIRMedication(BaseModel):
    """
    FHIR Medication resource — drug product definition.

    Maps PillSync's medicine catalog (brand_name, salt_composition,
    dosage_form, manufacturer) to FHIR.
    """
    resourceType: str = "Medication"
    id: Optional[str] = None
    status: FHIRMedicationStatus = FHIRMedicationStatus.ACTIVE
    code: Optional[FHIRCodeableConcept] = Field(
        None,
        description="Code identifying the medication (RxNorm, ATC, etc.)",
    )
    manufacturer: Optional[FHIRReference] = None
    form: Optional[FHIRCodeableConcept] = Field(
        None,
        description="Dosage form (tablet, capsule, syrup, etc.)",
    )
    ingredient: Optional[list[FHIRIngredient]] = None


# ===================================================================
# FHIR MedicationRequest Resource
# ===================================================================

class FHIRMedicationRequest(BaseModel):
    """
    FHIR MedicationRequest resource — prescription order.

    Used when a prescription is scanned via OCR and parsed into a
    structured medication order. Maps PillSync prescription_service
    output to FHIR-compliant format.
    """
    resourceType: str = "MedicationRequest"
    id: Optional[str] = None
    status: FHIRMedicationRequestStatus = FHIRMedicationRequestStatus.ACTIVE
    intent: FHIRMedicationRequestIntent = FHIRMedicationRequestIntent.ORDER
    medicationCodeableConcept: Optional[FHIRCodeableConcept] = Field(
        None,
        description="The medication being prescribed",
    )
    medicationReference: Optional[FHIRReference] = None
    subject: Optional[FHIRReference] = Field(
        None,
        description="The patient receiving the medication",
    )
    authoredOn: Optional[datetime] = Field(
        None,
        description="When the prescription was written",
    )
    requester: Optional[FHIRReference] = Field(
        None,
        description="The prescribing doctor / practitioner",
    )
    dosageInstruction: Optional[list[FHIRDosage]] = None
    dispenseRequest: Optional[dict] = Field(
        None,
        description="Dispensing details (quantity, expected supply duration)",
    )
    note: Optional[list[dict]] = Field(
        None,
        description="Additional notes or instructions",
    )


# ===================================================================
# FHIR MedicationStatement Resource
# ===================================================================

class FHIRMedicationStatement(BaseModel):
    """
    FHIR MedicationStatement resource — patient-reported medication use.

    Maps PillSync's active medication tracking (Medicine model +
    Schedule + DoseLog) to FHIR-compliant format for EHR integration.
    """
    resourceType: str = "MedicationStatement"
    id: Optional[str] = None
    status: FHIRMedicationStatementStatus = FHIRMedicationStatementStatus.ACTIVE
    medicationCodeableConcept: Optional[FHIRCodeableConcept] = None
    medicationReference: Optional[FHIRReference] = None
    subject: Optional[FHIRReference] = Field(
        None,
        description="The patient taking the medication",
    )
    effectivePeriod: Optional[FHIRPeriod] = Field(
        None,
        description="When the medication is/was being taken",
    )
    dateAsserted: Optional[datetime] = Field(
        None,
        description="When the statement was recorded",
    )
    dosage: Optional[list[FHIRDosage]] = None
    reasonCode: Optional[list[FHIRCodeableConcept]] = Field(
        None,
        description="Reason for taking the medication (disease category)",
    )
    note: Optional[list[dict]] = None
