"""Add DDI and clinical safety tracking tables

Revision ID: 7a8f9c1d2e3f
Revises: 4e63e6ea078a
Create Date: 2026-09-02 00:18:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7a8f9c1d2e3f'
down_revision: Union[str, None] = '4e63e6ea078a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create drug_interaction_logs table for clinical auditability
    op.create_table(
        'drug_interaction_logs',
        sa.Column('id', sa.UUID(), primary_key=True, nullable=False),
        sa.Column('user_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('candidate_drug', sa.String(length=255), nullable=False),
        sa.Column('interacting_drug', sa.String(length=255), nullable=False),
        sa.Column('severity', sa.String(length=50), nullable=False),
        sa.Column('clinical_title', sa.String(length=255), nullable=False),
        sa.Column('clinical_effect', sa.Text(), nullable=False),
        sa.Column('management_advice', sa.Text(), nullable=False),
        sa.Column('acknowledged_by_user', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_ddi_user_created', 'drug_interaction_logs', ['user_id', 'created_at'])

    # 2. Add pediatric safety metadata columns to users safely with default values
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('weight_kg', sa.Float(), nullable=True, comment='Patient body weight in kilograms'))
        batch_op.add_column(sa.Column('age_years', sa.Integer(), nullable=True, comment='Patient age in years'))


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('age_years')
        batch_op.drop_column('weight_kg')

    op.drop_index('ix_ddi_user_created', table_name='drug_interaction_logs')
    op.drop_table('drug_interaction_logs')
