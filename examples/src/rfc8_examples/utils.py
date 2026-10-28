"""Shared helpers: deterministic UUIDs, small zarr arrays, and a multiscale builder."""

import hashlib
import shutil
import uuid
from collections.abc import Sequence
from pathlib import Path

import ngio_collections as ngc
import numpy as np
import zarr


def get_uuid4(source: str) -> str:
    """A UUID (version 4 layout) derived from `source`, stable across runs."""
    digest = hashlib.shake_128(source.encode("utf-8")).hexdigest(16)
    return str(uuid.UUID(hex=digest, version=4))


def coordinate_system_id(key: str) -> str:
    """The coordinate-system id of the multiscale built with `multiscale(..., key)`."""
    return get_uuid4(f"{key}-cs")


def reset_dir(path: Path) -> Path:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True)
    return path


def create_zarr_array(
    path: str | Path,
    shape: Sequence[int] = (100, 100),
    seed: int = 1234567,
    dtype: str = "f4",
) -> None:
    rng = np.random.default_rng(seed)
    z = zarr.create_array(
        store=str(path),
        shape=tuple(shape),
        chunks=tuple(shape),
        dtype=dtype,
        overwrite=True,
    )
    if np.issubdtype(np.dtype(dtype), np.integer):
        z[...] = rng.integers(0, 10, size=tuple(shape), dtype=dtype)
    else:
        z[...] = rng.random(tuple(shape)).astype(dtype)


def write_scales(
    image_dir: Path,
    levels: int,
    shape: Sequence[int] = (100, 100),
    seed: int = 0,
    dtype: str = "f4",
) -> None:
    """Writes `s0`, `s1`, ... arrays, halving the shape at each level."""
    for level in range(levels):
        level_shape = [max(1, d // 2**level) for d in shape]
        create_zarr_array(image_dir / f"s{level}", level_shape, seed=seed + level, dtype=dtype)


def multiscale(
    name: str,
    key: str,
    *,
    levels: int = 2,
    axes: Sequence[str] = ("y", "x"),
    traits: Sequence[ngc.BaseTrait | dict] = (),
) -> ngc.Node:
    """A detached multiscale node with `levels` resolutions (factor 2 per level)."""
    cs_id = coordinate_system_id(key)
    system = ngc.CoordinateSystem(
        id=cs_id,
        name="physical",
        axes=[ngc.Axis(name=a, type="space", unit="micrometer") for a in axes],
    )
    scales = []
    for level in range(levels):
        sid = get_uuid4(f"{key}-s{level}")
        scales.append(
            ngc.Scale(
                id=sid,
                path=ngc.ZarrPath(href=f"./s{level}"),
                coordinate_transformations=[
                    ngc.ScaleTransformation(
                        scale=[float(2**level)] * len(axes),
                        input=ngc.ReferenceObj(type="scale", ref=sid),
                        output=ngc.ReferenceObj(type="coordinate_system", ref=cs_id),
                    )
                ],
            )
        )
    return ngc.new_multiscale(
        id=get_uuid4(key),
        name=name,
        coordinate_systems=[system],
        scales=scales,
        traits=list(traits),
    )


def create_image(
    destination: Path,
    node: ngc.Node,
    *,
    levels: int,
    seed: int,
    shape: Sequence[int] = (100, 100),
    dtype: str = "f4",
) -> ngc.Node:
    """Writes the multiscale document and its arrays; returns the declaring entry."""
    entry = ngc.create(str(destination), node, overwrite=True)
    write_scales(destination, levels, shape=shape, seed=seed, dtype=dtype)
    return entry


def yx_axes() -> list[ngc.Axis]:
    return [
        ngc.Axis(name="y", type="space", unit="micrometer"),
        ngc.Axis(name="x", type="space", unit="micrometer"),
    ]
