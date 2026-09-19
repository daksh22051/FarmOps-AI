"""add_source_reference_to_observations

Revision ID: a8c2f41d9999
Revises: 7a1e0b5f1234
Create Date: 2026-09-19 14:36:30.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8c2f41d9999'
down_revision: Union[str, None] = '7a1e0b5f1234'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('external_observations', sa.Column('source_reference', sa.String(length=128), nullable=True))
    op.create_index(op.f('ix_external_observations_source_reference'), 'external_observations', ['source_reference'], unique=False)
    op.create_index('ix_external_obs_dedupe', 'external_observations', ['farm_id', 'source', 'source_reference', 'observed_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_external_obs_dedupe', table_name='external_observations')
    op.drop_index(op.f('ix_external_observations_source_reference'), table_name='external_observations')
    op.drop_column('external_observations', 'source_reference')
