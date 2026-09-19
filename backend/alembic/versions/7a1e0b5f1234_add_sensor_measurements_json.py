"""add_sensor_measurements_json

Revision ID: 7a1e0b5f1234
Revises: 271fb424ed39
Create Date: 2026-09-19 14:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a1e0b5f1234'
down_revision: Union[str, None] = '271fb424ed39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sensor_events', sa.Column('measurements', sa.JSON(), nullable=True))
    op.add_column('sensor_events', sa.Column('metadata_payload', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('sensor_events', 'metadata_payload')
    op.drop_column('sensor_events', 'measurements')
