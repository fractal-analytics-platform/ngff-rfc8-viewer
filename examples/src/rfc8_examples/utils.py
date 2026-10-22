import hashlib
import json
import random
import uuid

rnd = random.Random()
rnd.seed(12333222)


def get_uuid4(source: str | bytes | dict | None = None) -> str:
    if source is None:
        kwargs = {"int": rnd.getrandbits(128)}
    elif isinstance(source, bytes):
        kwargs = {"hex": hashlib.shake_128(source).hexdigest(16)}
    elif isinstance(source, str):
        kwargs = {
            "hex": hashlib.shake_128(bytes(source, encoding="utf-8")).hexdigest(16)
        }
    elif isinstance(source, dict):
        kwargs = {
            "hex": hashlib.shake_128(
                bytes(json.dumps(source), encoding="utf-8")
            ).hexdigest(16)
        }
    else:
        raise NotImplementedError(f"{type(source)=} is not supported")
    return str(uuid.UUID(**kwargs, version=4))
