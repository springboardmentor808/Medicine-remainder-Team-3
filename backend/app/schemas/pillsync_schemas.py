from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

class UserRole(str, Enum):
    PATIENT = "patient"
    CAREGIVER = "caregiver"
    ADMIN = "admin"

class DiseaseCategory(str, Enum):
    BLOOD_PRESSURE = "Blood Pressure"
    DIABETES = "Diabetes"
    THYROID = "Thyroid"
    ANTIBIOTICS = "Antibiotics"
    VITAMINS = "Vitamins"
    HEART = "Heart Medications"
    OTHER = "General Healthcare"

class ReminderAction(str, Enum):
    TAKEN = "Taken"
    MISSED = "Missed"
    SNOOZE = "Snooze"

class DoseFrequencyPattern(str, Enum):
    ONCE_DAILY_NIGHT = "0-0-1"
    TWICE_DAILY_MORNING_NIGHT = "1-0-1"
    TWICE_DAILY_AFTERNOON_NIGHT = "0-1-1"
    THRICE_DAILY = "1-1-1"
    CUSTOM = "custom"

# Module 1: Auth & User Schemas
class LoginRequest(BaseModel):
    username: str
    password: str
    role: UserRole = UserRole.PATIENT

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: UserRole = UserRole.PATIENT
    full_name: str
    phone: Optional[str] = None

class UserProfileResponse(BaseModel):
    user_id: str
    username: str
    email: str
    role: UserRole
    full_name: str
    assigned_patients: Optional[List[str]] = []

# Module 2 & 7: Medicine & Disease Schemas
class MedicineCreate(BaseModel):
    name: str
    disease_category: DiseaseCategory
    dosage: str  # e.g., "500mg" or "2 Tablets"
    initial_quantity: int  # e.g., 60
    current_stock: int  # e.g., 60
    daily_frequency: int  # e.g., 2 times per day
    quantity_per_dose: int = 1
    schedule_times: List[str] = ["08:00 AM", "08:00 PM"]
    notes: Optional[str] = ""

class MedicineResponse(MedicineCreate):
    id: str
    user_id: str
    depletion_days_left: int
    estimated_refill_date: str
    low_stock_warning: bool

# Module 3: OCR Prescription Request/Response
class OCRResponse(BaseModel):
    success: bool
    filename: str
    raw_text: str
    extracted_medicine_name: Optional[str] = None
    extracted_dosage: Optional[str] = None
    extracted_quantity: Optional[int] = None
    extracted_frequency: Optional[str] = None

# Schedule Schemas
class ScheduleCreate(BaseModel):
    medicine_id: str
    frequency_pattern: Optional[str] = "custom"  # "1-1-1", "1-0-1", "0-1-1", "0-0-1", "custom"
    scheduled_times: Optional[List[str]] = None  # e.g. ["08:00", "20:00"]
    day_of_week: Optional[str] = None  # NULL = everyday, or 'monday', etc.
    is_active: bool = True

class ScheduleResponse(BaseModel):
    id: str
    user_id: str
    medicine_id: str
    scheduled_time: str
    day_of_week: Optional[str] = None
    frequency_pattern: Optional[str] = None
    dose_label: Optional[str] = None
    is_active: bool
    created_at: datetime

class ScheduleBatchCreateResponse(BaseModel):
    message: str
    schedules: List[ScheduleResponse]

# Module 4 & 5: Reminder & Adherence Schemas
class RecordActionRequest(BaseModel):
    schedule_id: str
    action: ReminderAction
    action_time: Optional[str] = None
    scheduled_date: Optional[str] = None  # YYYY-MM-DD
    snooze_minutes: Optional[int] = Field(default=15, ge=1, le=1440)
    notes: Optional[str] = None

class DoseLogResponse(BaseModel):
    id: str
    user_id: str
    medicine_id: str
    schedule_id: Optional[str] = None
    scheduled_date: str
    scheduled_time: str
    action: ReminderAction
    action_time: datetime
    snooze_minutes: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime

class DailyDoseItem(BaseModel):
    schedule_id: str
    medicine_id: str
    medicine_name: str
    dosage: str
    scheduled_time: str
    status: str  # "Taken", "Missed", "Snoozed", "Pending"
    action_time: Optional[datetime] = None
    snooze_minutes: Optional[int] = None

class DailyDoseTrackingResponse(BaseModel):
    date: str
    total_doses: int
    taken_count: int
    missed_count: int
    snoozed_count: int
    pending_count: int
    doses: List[DailyDoseItem]

class AdherenceHistoryResponse(BaseModel):
    patient_id: str
    total_records: int
    logs: List[DoseLogResponse]

class AdherenceReportResponse(BaseModel):
    patient_id: str
    total_scheduled_doses: int
    taken_doses: int
    missed_doses: int
    snoozed_doses: int
    adherence_percentage: float
    consistency_grade: str


# Module 6: AI Refill Prediction Engine Schemas
class RefillPredictionResponse(BaseModel):
    medicine_id: str
    medicine_name: str
    current_stock: int
    daily_consumption: float
    days_until_depletion: int
    estimated_depletion_date: str
    recommended_refill_date: str
    is_low_stock: bool
    notification_message: str
