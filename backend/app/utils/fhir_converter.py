"""
PillSync FHIR Converter (Track 3 -- Engineer 3).

Converts internal PillSync SQLAlchemy models (Medicine, Schedule, Refill)
to HL7 FHIR R4 JSON resources for healthcare system interoperability.

Conversion mappings:
  - Medicine + Schedule -> FHIR MedicationStatement
  - OCR Prescription Parse -> FHIR MedicationRequest
  - Medicine -> FHIR Medication

Usage:
    from backend.app.utils.fhir_converter import FHIRConverter

    converter = FHIRConverter()
    fhir_statement = converter.medicine_to_fhir_statement(medicine, schedules)
    fhir_json = fhir_statement.model_dump(exclude_none=True)
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel

from app.schemas.fhir_schemas import (
    FHIRCoding,
    FHIRCodeableConcept,
    FHIRDosage,
    FHIRDoseAndRate,
    FHIRIngredient,
    FHIRMedication,
    FHIRMedicationRequest,
    FHIRMedicationRequestIntent,
    FHIRMedicationRequestStatus,
    FHIRMedicationStatement,
    FHIRMedicationStatementStatus,
    FHIRPeriod,
    FHIRQuantity,
    FHIRReference,
    FHIRTiming,
    FHIRTimingRepeat,
)


# ---------------------------------------------------------------------------
# Frequency Pattern Mapping
# Maps PillSync frequency strings to FHIR Timing codes
# ---------------------------------------------------------------------------
FREQUENCY_TO_FHIR = {
    "1-0-0": {"frequency": 1, "period": 1, "periodUnit": "d", "when": ["MORN"]},
    "0-1-0": {"frequency": 1, "period": 1, "periodUnit": "d", "when": ["AFT"]},
    "0-0-1": {"frequency": 1, "period": 1, "periodUnit": "d", "when": ["NIGHT"]},
    "1-1-0": {"frequency": 2, "period": 1, "periodUnit": "d", "when": ["MORN", "AFT"]},
    "1-0-1": {"frequency": 2, "period": 1, "periodUnit": "d", "when": ["MORN", "NIGHT"]},
    "0-1-1": {"frequency": 2, "period": 1, "periodUnit": "d", "when": ["AFT", "NIGHT"]},
    "1-1-1": {"frequency": 3, "period": 1, "periodUnit": "d", "when": ["MORN", "AFT", "NIGHT"]},
    "BD": {"frequency": 2, "period": 1, "periodUnit": "d"},
    "TDS": {"frequency": 3, "period": 1, "periodUnit": "d"},
    "QID": {"frequency": 4, "period": 1, "periodUnit": "d"},
    "OD": {"frequency": 1, "period": 1, "periodUnit": "d"},
    "HS": {"frequency": 1, "period": 1, "periodUnit": "d", "when": ["NIGHT"]},
    "SOS": {"frequency": 1, "period": 1, "periodUnit": "d"},
    "WEEKLY": {"frequency": 1, "period": 1, "periodUnit": "wk"},
}

# Dosage form to FHIR route mapping
FORM_TO_ROUTE = {
    "Tablet": ("oral", "Oral", "http://snomed.info/sct", "26643006"),
    "Capsule": ("oral", "Oral", "http://snomed.info/sct", "26643006"),
    "Syrup": ("oral", "Oral", "http://snomed.info/sct", "26643006"),
    "Suspension": ("oral", "Oral", "http://snomed.info/sct", "26643006"),
    "Injection": ("intravenous", "Intravenous", "http://snomed.info/sct", "47625008"),
    "Cream": ("topical", "Topical", "http://snomed.info/sct", "6064005"),
    "Ointment": ("topical", "Topical", "http://snomed.info/sct", "6064005"),
    "Gel": ("topical", "Topical", "http://snomed.info/sct", "6064005"),
    "Eye Drops": ("ophthalmic", "Ophthalmic", "http://snomed.info/sct", "54485002"),
    "Ear Drops": ("otic", "Otic", "http://snomed.info/sct", "10547007"),
    "Inhaler": ("inhalation", "Inhalation", "http://snomed.info/sct", "18679011000036101"),
    "Nasal Spray": ("nasal", "Nasal", "http://snomed.info/sct", "46713006"),
    "Drops": ("oral", "Oral", "http://snomed.info/sct", "26643006"),
    "Patch": ("transdermal", "Transdermal", "http://snomed.info/sct", "45890007"),
}


class FHIRConverter:
    """
    Converts PillSync internal models to HL7 FHIR R4 compliant resources.
    """

    def medicine_to_fhir_medication(
        self,
        medicine,
        salt_name: Optional[str] = None,
        strength: Optional[str] = None,
        dosage_form: Optional[str] = None,
        manufacturer_name: Optional[str] = None,
        rxcui: Optional[str] = None,
    ) -> FHIRMedication:
        """
        Convert a PillSync Medicine model to FHIR Medication resource.

        Args:
            medicine: SQLAlchemy Medicine instance
            salt_name: Active ingredient name (from catalog)
            strength: Dosage strength (e.g., "500mg")
            dosage_form: Form (Tablet, Syrup, etc.)
            manufacturer_name: Manufacturer name
            rxcui: RxNorm concept identifier (if resolved)
        """
        # Build medication code
        codings = []
        if rxcui:
            codings.append(FHIRCoding(
                system="http://www.nlm.nih.gov/research/umls/rxnorm",
                code=rxcui,
                display=salt_name or medicine.name,
            ))

        code = FHIRCodeableConcept(
            coding=codings,
            text=medicine.name,
        )

        # Build form
        form = None
        if dosage_form:
            form = FHIRCodeableConcept(text=dosage_form)

        # Build ingredient
        ingredients = []
        if salt_name:
            ingredient = FHIRIngredient(
                itemCodeableConcept=FHIRCodeableConcept(text=salt_name),
                isActive=True,
            )
            if strength:
                # Parse strength like "500mg" -> value=500, unit="mg"
                import re
                match = re.match(r"(\d+(?:\.\d+)?)\s*(\w+)", strength)
                if match:
                    ingredient.strength = FHIRQuantity(
                        value=float(match.group(1)),
                        unit=match.group(2),
                    )
            ingredients.append(ingredient)

        # Build manufacturer reference
        manufacturer = None
        if manufacturer_name:
            manufacturer = FHIRReference(display=manufacturer_name)

        return FHIRMedication(
            id=str(medicine.id),
            code=code,
            manufacturer=manufacturer,
            form=form,
            ingredient=ingredients if ingredients else None,
        )

    def medicine_to_fhir_statement(
        self,
        medicine,
        schedules: Optional[list] = None,
        dosage_form: Optional[str] = None,
    ) -> FHIRMedicationStatement:
        """
        Convert a PillSync Medicine + its Schedules to a FHIR MedicationStatement.

        This represents the patient's current active medication with dosing info.
        """
        # Build medication concept
        med_concept = FHIRCodeableConcept(text=medicine.name)

        # Build subject reference
        subject = FHIRReference(
            reference=f"Patient/{medicine.user_id}",
            display=None,
        )

        # Build dosage instructions
        dosages = []
        if schedules:
            for schedule in schedules:
                dosage = self._schedule_to_dosage(
                    schedule, medicine, dosage_form
                )
                dosages.append(dosage)
        else:
            # Build a basic dosage from medicine fields
            dosage = FHIRDosage(
                text=f"{medicine.dosage} {medicine.daily_frequency}x daily",
                timing=FHIRTiming(
                    repeat=FHIRTimingRepeat(
                        frequency=medicine.daily_frequency,
                        period=1,
                        periodUnit="d",
                    ),
                ),
                doseAndRate=[
                    FHIRDoseAndRate(
                        doseQuantity=FHIRQuantity(
                            value=medicine.quantity_per_dose,
                            unit="dose",
                        ),
                    )
                ],
            )
            dosages.append(dosage)

        # Build reason code (disease category)
        reason_codes = []
        if medicine.disease_category:
            reason_codes.append(
                FHIRCodeableConcept(text=medicine.disease_category)
            )

        # Build notes
        notes = []
        if medicine.notes:
            notes.append({"text": medicine.notes})

        return FHIRMedicationStatement(
            id=str(medicine.id),
            status=FHIRMedicationStatementStatus.ACTIVE,
            medicationCodeableConcept=med_concept,
            subject=subject,
            effectivePeriod=FHIRPeriod(
                start=medicine.created_at,
            ),
            dateAsserted=datetime.now(timezone.utc),
            dosage=dosages if dosages else None,
            reasonCode=reason_codes if reason_codes else None,
            note=notes if notes else None,
        )

    def prescription_to_fhir_request(
        self,
        parsed_entities: dict,
        patient_id: Optional[str] = None,
    ) -> FHIRMedicationRequest:
        """
        Convert OCR-parsed prescription entities to a FHIR MedicationRequest.

        Args:
            parsed_entities: Dict from NLP pipeline with keys:
                drug_name, dosage, frequency, duration, instruction
            patient_id: Patient UUID string
        """
        drug_name = parsed_entities.get("drug_name", "Unknown")
        dosage_str = parsed_entities.get("dosage", "")
        frequency_str = parsed_entities.get("frequency", "")
        duration_str = parsed_entities.get("duration", "")
        instruction = parsed_entities.get("instruction", "")

        # Build medication concept
        med_concept = FHIRCodeableConcept(text=drug_name)

        # Build dosage
        dosage = FHIRDosage(
            text=f"{drug_name} {dosage_str} {frequency_str} {instruction}".strip(),
        )

        # Map frequency to FHIR timing
        freq_key = frequency_str.upper().replace(" ", "")
        if freq_key in FREQUENCY_TO_FHIR:
            timing_data = FREQUENCY_TO_FHIR[freq_key]
            dosage.timing = FHIRTiming(
                repeat=self._create_timing_repeat(timing_data),
            )

        # Parse dosage strength
        if dosage_str:
            import re
            match = re.match(r"(\d+(?:\.\d+)?)\s*(\w+)", dosage_str)
            if match:
                dosage.doseAndRate = [
                    FHIRDoseAndRate(
                        doseQuantity=FHIRQuantity(
                            value=float(match.group(1)),
                            unit=match.group(2),
                        ),
                    )
                ]

        # Build subject
        subject = None
        if patient_id:
            subject = FHIRReference(reference=f"Patient/{patient_id}")

        # Build notes
        notes = []
        if instruction:
            notes.append({"text": instruction})
        if duration_str:
            notes.append({"text": f"Duration: {duration_str}"})

        return FHIRMedicationRequest(
            status=FHIRMedicationRequestStatus.ACTIVE,
            intent=FHIRMedicationRequestIntent.ORDER,
            medicationCodeableConcept=med_concept,
            subject=subject,
            authoredOn=datetime.now(timezone.utc),
            dosageInstruction=[dosage],
            note=notes if notes else None,
        )

    @staticmethod
    def _create_timing_repeat(
        timing_data: dict, time_of_day: Optional[list[str]] = None
    ) -> FHIRTimingRepeat:
        """Construct a strictly-typed FHIRTimingRepeat instance."""
        freq_raw = timing_data.get("frequency")
        period_raw = timing_data.get("period")
        unit_raw = timing_data.get("periodUnit")
        when_raw = timing_data.get("when")

        frequency: Optional[int] = int(freq_raw) if freq_raw is not None else None
        period: Optional[float] = float(period_raw) if period_raw is not None else None
        period_unit: Optional[str] = str(unit_raw) if unit_raw is not None else None
        when: Optional[list[str]] = list(when_raw) if when_raw is not None else None

        return FHIRTimingRepeat(
            frequency=frequency,
            period=period,
            periodUnit=period_unit,
            when=when,
            timeOfDay=time_of_day,
        )

    def _schedule_to_dosage(
        self, schedule, medicine, dosage_form: Optional[str] = None
    ) -> FHIRDosage:
        """Convert a PillSync Schedule to a FHIR Dosage element."""
        # Build timing
        timing_data = {}
        freq_pattern = getattr(schedule, "frequency_pattern", None)
        if freq_pattern and freq_pattern in FREQUENCY_TO_FHIR:
            timing_data = FREQUENCY_TO_FHIR[freq_pattern]
        else:
            timing_data = {
                "frequency": medicine.daily_frequency,
                "period": 1,
                "periodUnit": "d",
            }

        # Add time of day from schedule
        scheduled_time = getattr(schedule, "scheduled_time", None)
        time_of_day = None
        if scheduled_time:
            time_of_day = [scheduled_time.strftime("%H:%M:%S")]

        repeat = self._create_timing_repeat(timing_data, time_of_day=time_of_day)

        # Build route from dosage form
        route = None
        if dosage_form and dosage_form in FORM_TO_ROUTE:
            route_info = FORM_TO_ROUTE[dosage_form]
            route = FHIRCodeableConcept(
                coding=[FHIRCoding(
                    system=route_info[2],
                    code=route_info[3],
                    display=route_info[1],
                )],
                text=route_info[1],
            )

        # Build dose label
        dose_label = getattr(schedule, "dose_label", "")
        text = f"{medicine.dosage} - {dose_label}" if dose_label else medicine.dosage

        return FHIRDosage(
            text=text,
            timing=FHIRTiming(repeat=repeat),
            route=route,
            doseAndRate=[
                FHIRDoseAndRate(
                    doseQuantity=FHIRQuantity(
                        value=medicine.quantity_per_dose,
                        unit="dose",
                    ),
                )
            ],
        )

    def to_fhir_json(self, fhir_resource: BaseModel) -> dict:
        """
        Export any FHIR resource to a clean JSON dictionary,
        excluding None values for FHIR compliance.
        """
        return fhir_resource.model_dump(exclude_none=True, mode="json")
