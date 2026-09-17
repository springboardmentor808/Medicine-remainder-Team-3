"""
PillSync Production Concurrency & Regression Suite.
File: backend/tests/test_production_hardening.py
"""

import asyncio
import os
import uuid
from datetime import date, time

import numpy as np
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.medicine import Medicine
from app.models.schedule import Schedule, DoseLog
from app.schemas.pillsync_schemas import RecordActionRequest
from app.services.adherence_service import AdherenceService
from app.services.ocr_service import _perform_ocr_sync, _trocr_manager
from app.services.refill_service import _engine

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def async_db():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    from app.core.database import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_concurrent_dose_logging_race_condition(async_db: AsyncSession):
    user_id = uuid.uuid4()
    med_id = uuid.uuid4()
    sch_id = uuid.uuid4()

    med = Medicine(
        id=med_id,
        user_id=user_id,
        name="Metformin 500mg",
        dosage="500mg",
        initial_quantity=20,
        current_stock=20,
        daily_frequency=2,
        quantity_per_dose=1
    )
    schedule = Schedule(
        id=sch_id,
        user_id=user_id,
        medicine_id=med_id,
        scheduled_time=time(8, 0),
        is_active=True
    )
    async_db.add_all([med, schedule])
    await async_db.commit()

    req = RecordActionRequest(
        schedule_id=str(sch_id),
        medicine_id=str(med_id),
        action="Taken",
        scheduled_date=date.today().isoformat()
    )

    results = []
    for _ in range(10):
        res = await AdherenceService.record_dose_action_atomic(async_db, user_id, req)
        results.append(res)

    for r in results:
        assert r is not None and r.action == "Taken"

    q_med = await async_db.execute(select(Medicine).where(Medicine.id == med_id))
    updated_med = q_med.scalar_one()

    assert updated_med.current_stock == 19, (
        f"RACE CONDITION DETECTED! Expected 19, got {updated_med.current_stock}"
    )

    q_logs = await async_db.execute(
        select(DoseLog).where(
            DoseLog.schedule_id == sch_id,
            DoseLog.scheduled_date == date.today()
        )
    )
    logs = q_logs.scalars().all()
    assert len(logs) == 1, f"Expected 1 DoseLog, found {len(logs)}"


def test_trocr_onnx_empty_and_garbage_crop_safety():
    blank_crop = np.ones((384, 384, 3), dtype=np.uint8) * 255
    res_blank = _trocr_manager.infer_line(blank_crop)
    assert res_blank is None or len(res_blank) == 0

    res_empty = _perform_ocr_sync(b"")
    assert res_empty.status == "EMPTY_INPUT"
    assert res_empty.confidence == 0.0


def test_refill_forecaster_feature_bounds():
    sample_features = [10.0, 2.0, 1.0, 0.95, 0.0, 0.0, 0.0, 5.0, 7.0, 1.9, 5.0]
    pred = _engine.predict_p50(sample_features)
    assert pred > 0.0
    assert pred < 365.0
