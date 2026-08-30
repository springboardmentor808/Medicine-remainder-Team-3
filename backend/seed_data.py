"""
PillSync Database Seeder.

Populates the SQLite/PostgreSQL database with realistic clinical demo data:
- Users (Patients, Caregivers, Admin)
- Medicines across various disease categories
- Medication Schedules (1-1-1, 1-0-1, etc.)
- Dose Logs for adherence history and charts
- Refill tracking records
- Caregiver-Patient assignments
"""

import asyncio
import uuid
from datetime import date, datetime, time, timedelta, timezone
from sqlalchemy import select, or_
from app.core.database import async_session_factory, init_db
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.medicine import Medicine
from app.models.schedule import Schedule, DoseLog
from app.models.refill import Refill
from app.models.caregiver_patient import caregiver_patients


async def seed():
    print("[Seed] Initializing database tables...")
    await init_db()

    async with async_session_factory() as session:
        print("[Seed] Checking existing seed users...")
        # Check if rahul already exists
        res = await session.execute(select(User).where(or_(User.username == "rahul", User.email == "rahul@pillsync.com", User.email == "rahul@example.com")))
        patient_rahul = res.scalar_one_or_none()

        if not patient_rahul:
            patient_rahul = User(
                id=uuid.uuid4(),
                username="rahul",
                email="rahul@pillsync.com",
                hashed_password=hash_password("Password123!"),
                full_name="Rahul Sharma",
                phone="+91 98765 43210",
                role=UserRole.PATIENT,
                is_active=True,
            )
            session.add(patient_rahul)

        res_priya = await session.execute(select(User).where(or_(User.username == "priya", User.email == "priya@pillsync.com")))
        patient_priya = res_priya.scalar_one_or_none()
        if not patient_priya:
            patient_priya = User(
                id=uuid.uuid4(),
                username="priya",
                email="priya@pillsync.com",
                hashed_password=hash_password("Password123!"),
                full_name="Priya Patel",
                phone="+91 98111 22334",
                role=UserRole.PATIENT,
                is_active=True,
            )
            session.add(patient_priya)

        res_care = await session.execute(select(User).where(or_(User.username == "caregiver_amit", User.email == "amit.caregiver@pillsync.com")))
        caregiver_amit = res_care.scalar_one_or_none()
        if not caregiver_amit:
            caregiver_amit = User(
                id=uuid.uuid4(),
                username="caregiver_amit",
                email="amit.caregiver@pillsync.com",
                hashed_password=hash_password("Password123!"),
                full_name="Dr. Amit Verma",
                phone="+91 98222 33445",
                role=UserRole.CAREGIVER,
                is_active=True,
            )
            session.add(caregiver_amit)

        res_admin = await session.execute(select(User).where(or_(User.username == "admin", User.email == "admin@pillsync.com", User.email == "admin@example.com")))
        admin_user = res_admin.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                id=uuid.uuid4(),
                username="admin",
                email="admin@pillsync.com",
                hashed_password=hash_password("AdminPass123!"),
                full_name="System Administrator",
                phone="+91 99999 00000",
                role=UserRole.ADMIN,
                is_active=True,
            )
            session.add(admin_user)

        await session.flush()

        # Seed Medicines for Rahul
        res_meds = await session.execute(select(Medicine).where(Medicine.user_id == patient_rahul.id))
        existing_meds = res_meds.scalars().all()

        if len(existing_meds) == 0:
            print(f"[Seed] Adding medicines for patient {patient_rahul.full_name}...")
            m1 = Medicine(
                id=uuid.uuid4(),
                user_id=patient_rahul.id,
                name="Metformin",
                disease_category="Diabetes",
                dosage="500mg",
                initial_quantity=60,
                current_stock=42,
                daily_frequency=2,
                quantity_per_dose=1,
                notes="Take with meals (Breakfast & Dinner)",
            )
            m2 = Medicine(
                id=uuid.uuid4(),
                user_id=patient_rahul.id,
                name="Amlodipine",
                disease_category="Blood Pressure",
                dosage="5mg",
                initial_quantity=30,
                current_stock=8,
                daily_frequency=1,
                quantity_per_dose=1,
                notes="Take at 9:00 PM every night",
            )
            m3 = Medicine(
                id=uuid.uuid4(),
                user_id=patient_rahul.id,
                name="Atorvastatin",
                disease_category="Heart Medications",
                dosage="20mg",
                initial_quantity=30,
                current_stock=24,
                daily_frequency=1,
                quantity_per_dose=1,
                notes="Take post lunch at 1:00 PM",
            )
            m4 = Medicine(
                id=uuid.uuid4(),
                user_id=patient_rahul.id,
                name="Levothyroxine",
                disease_category="Thyroid",
                dosage="50mcg",
                initial_quantity=30,
                current_stock=15,
                daily_frequency=1,
                quantity_per_dose=1,
                notes="Take on empty stomach 6:30 AM with water",
            )
            m5 = Medicine(
                id=uuid.uuid4(),
                user_id=patient_rahul.id,
                name="Vitamin D3",
                disease_category="Vitamins",
                dosage="60,000 IU",
                initial_quantity=10,
                current_stock=3,
                daily_frequency=1,
                quantity_per_dose=1,
                notes="Take weekly on Sunday morning",
            )

            session.add_all([m1, m2, m3, m4, m5])
            await session.flush()

            # Seed Schedules for Rahul
            print("[Seed] Adding schedules for medicines...")
            s1 = Schedule(
                id=uuid.uuid4(),
                user_id=patient_rahul.id,
                medicine_id=m1.id,
                scheduled_time=time(8, 0),
                day_of_week="ALL",
                frequency_pattern="1-0-1",
                dose_label="Morning (After breakfast)",
                is_active=True,
            )
            s2 = Schedule(
                id=uuid.uuid4(),
                user_id=patient_rahul.id,
                medicine_id=m1.id,
                scheduled_time=time(20, 0),
                day_of_week="ALL",
                frequency_pattern="1-0-1",
                dose_label="Night (After dinner)",
                is_active=True,
            )
            s3 = Schedule(
                id=uuid.uuid4(),
                user_id=patient_rahul.id,
                medicine_id=m2.id,
                scheduled_time=time(21, 0),
                day_of_week="ALL",
                frequency_pattern="0-0-1",
                dose_label="Night",
                is_active=True,
            )
            s4 = Schedule(
                id=uuid.uuid4(),
                user_id=patient_rahul.id,
                medicine_id=m4.id,
                scheduled_time=time(6, 30),
                day_of_week="ALL",
                frequency_pattern="1-0-0",
                dose_label="Morning Fasting",
                is_active=True,
            )
            session.add_all([s1, s2, s3, s4])
            await session.flush()

            # Seed Refill tracking records
            print("[Seed] Adding refill alerts...")
            r1 = Refill(
                id=uuid.uuid4(),
                user_id=patient_rahul.id,
                medicine_id=m2.id,
                total_pills_remaining=m2.current_stock,
                daily_dose_count=1,
                estimated_refill_date=date.today() + timedelta(days=8),
                low_stock_threshold=10,
            )
            r2 = Refill(
                id=uuid.uuid4(),
                user_id=patient_rahul.id,
                medicine_id=m1.id,
                total_pills_remaining=m1.current_stock,
                daily_dose_count=2,
                estimated_refill_date=date.today() + timedelta(days=21),
                low_stock_threshold=15,
            )
            session.add_all([r1, r2])

            # Seed Historical Dose Logs (Past 7 days)
            print("[Seed] Adding 7-day adherence history logs...")
            today = date.today()
            for day_offset in range(7, 0, -1):
                log_date = today - timedelta(days=day_offset)
                log1 = DoseLog(
                    id=uuid.uuid4(),
                    user_id=patient_rahul.id,
                    medicine_id=m1.id,
                    schedule_id=s1.id,
                    scheduled_date=log_date,
                    scheduled_time=time(8, 0),
                    action="taken",
                    action_time=datetime.combine(log_date, time(8, 5), tzinfo=timezone.utc),
                    notes="Taken with food",
                )
                log2 = DoseLog(
                    id=uuid.uuid4(),
                    user_id=patient_rahul.id,
                    medicine_id=m2.id,
                    schedule_id=s3.id,
                    scheduled_date=log_date,
                    scheduled_time=time(21, 0),
                    action="taken" if day_offset != 2 else "missed",
                    action_time=datetime.combine(log_date, time(21, 10), tzinfo=timezone.utc) if day_offset != 2 else None,
                    notes="Routine bedtime dose" if day_offset != 2 else "Fell asleep early",
                )
                session.add_all([log1, log2])

        # Assign Patient Rahul to Caregiver Amit
        res_cp = await session.execute(
            select(caregiver_patients).where(
                caregiver_patients.c.caregiver_id == caregiver_amit.id,
                caregiver_patients.c.patient_id == patient_rahul.id,
            )
        )
        if not res_cp.first():
            print("[Seed] Assigning patient Rahul to Caregiver Dr. Amit...")
            await session.execute(
                caregiver_patients.insert().values(
                    id=uuid.uuid4(),
                    caregiver_id=caregiver_amit.id,
                    patient_id=patient_rahul.id,
                    assigned_at=datetime.now(timezone.utc),
                )
            )

        await session.commit()
        print("[Seed] Successfully seeded PillSync database with realistic clinical data!")


if __name__ == "__main__":
    asyncio.run(seed())
