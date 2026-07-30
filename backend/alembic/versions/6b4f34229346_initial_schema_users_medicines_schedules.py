"""Initial schema: users, medicines, schedules, caregiver_patients

Revision ID: 6b4f34229346
Revises: 
Create Date: 2026-07-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6b4f34229346'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Create ENUM types ---
    user_role_enum = postgresql.ENUM('patient', 'caregiver', 'admin', name='user_role', create_type=False)
    disease_category_enum = postgresql.ENUM(
        'Blood Pressure', 'Diabetes', 'Thyroid', 'Antibiotics',
        'Vitamins', 'Heart Medications', 'General Healthcare',
        name='disease_category', create_type=False
    )

    user_role_enum.create(op.get_bind(), checkfirst=True)
    disease_category_enum.create(op.get_bind(), checkfirst=True)

    # --- Table: users ---
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('username', sa.String(50), nullable=False, unique=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('role', user_role_enum, nullable=False, server_default='patient'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_username', 'users', ['username'])
    op.create_index('ix_users_email', 'users', ['email'])

    # --- Table: caregiver_patients ---
    op.create_table(
        'caregiver_patients',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('caregiver_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('caregiver_id', 'patient_id', name='uq_caregiver_patient')
    )
    op.create_index('ix_caregiver_patients_caregiver_id', 'caregiver_patients', ['caregiver_id'])
    op.create_index('ix_caregiver_patients_patient_id', 'caregiver_patients', ['patient_id'])

    # --- Table: medicines ---
    op.create_table(
        'medicines',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('disease_category', disease_category_enum, nullable=False, server_default='General Healthcare'),
        sa.Column('dosage', sa.String(50), nullable=False),
        sa.Column('initial_quantity', sa.Integer(), nullable=False),
        sa.Column('current_stock', sa.Integer(), nullable=False),
        sa.Column('daily_frequency', sa.Integer(), nullable=False),
        sa.Column('quantity_per_dose', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_medicines_id', 'medicines', ['id'])
    op.create_index('ix_medicines_user_id', 'medicines', ['user_id'])
    op.create_index('ix_medicines_name', 'medicines', ['name'])

    # --- Table: schedules ---
    op.create_table(
        'schedules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('medicine_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('medicines.id', ondelete='CASCADE'), nullable=False),
        sa.Column('scheduled_time', sa.Time(), nullable=False),
        sa.Column('day_of_week', sa.String(10), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_schedules_id', 'schedules', ['id'])
    op.create_index('ix_schedules_user_id', 'schedules', ['user_id'])
    op.create_index('ix_schedules_medicine_id', 'schedules', ['medicine_id'])


def downgrade() -> None:
    op.drop_table('schedules')
    op.drop_table('medicines')
    op.drop_table('caregiver_patients')
    op.drop_table('users')

    op.execute('DROP TYPE IF EXISTS user_role')
    op.execute('DROP TYPE IF EXISTS disease_category')
