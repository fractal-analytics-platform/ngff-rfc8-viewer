import random
import uuid
from pathlib import Path

BASE_PATH = Path(__file__).parents[2] / "data"

rnd = random.Random()
rnd.seed(123)


def get_uuid4() -> str:
    return str(uuid.UUID(int=rnd.getrandbits(128), version=4))
