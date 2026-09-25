"""Оптимизация сгенерированного key art для веба.

Скрипт берёт PNG из media-output/, уменьшает до нужной ширины,
сохраняет как JPEG (q=82, progressive) и создаёт крошечный LQIP
(16 px, base64) в lib/image-placeholders.ts — он показывается,
пока грузится полноразмерная картинка, чтобы не было «прыжка» контента.

Использование:  python scripts/optimize-images.py
"""

from __future__ import annotations

import base64
import io
import json
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "media-output"
TARGET = ROOT / "public" / "images"

# имя на выходе -> (исходный файл, ширина на выходе)
JOBS: dict[str, tuple[str, int]] = {
    "hero-wide": ("img-mugw7iag-133c914d.png", 2400),
    "hero-mobile": ("img-mugw7bca-05598a9d.png", 1080),
    "quest-psycho": ("img-mugw7ao8-0e664b41.png", 1600),
    "quest-ritual": ("img-mugw8han-7a05e151.png", 1600),
    "quest-ischadie": ("img-mugw8en5-50c7c358.png", 1600),
    "quest-paranormal": ("img-mugw8fbs-6d81c593.png", 1600),
    "quest-psycho-new": ("img-mugw9gbs-1ef3237a.png", 1600),
    "quest-guests": ("img-mugw9c1b-1a830664.png", 1600),
    "door-final": ("img-mugw98p3-f1840196.png", 1920),
    "team-emotions": ("img-mugw9hf3-eb4c9f84.png", 1400),
    # Персонажи (портреты актёров, вертикальные)
    "actor-psycho": ("img-muh10pvq-9a1fe5cb.png", 1000),
    "actor-ritual": ("img-muh10nix-477aebe7.png", 1000),
    "actor-nurse": ("img-muh10uq9-58c8ec9f.png", 1000),
    "actor-guest": ("img-muh10p3b-e16e0145.png", 1000),
    # Галерея «изнутри»
    "inside-hand": ("img-muh11m3j-8c384e50.png", 1400),
    "inside-mirror": ("img-muh11xhe-d7fe34cd.png", 1400),
    "inside-sheets": ("img-muh11ycx-fa7bb4fd.png", 1400),
    "inside-chair": ("img-muh12qgl-df23059b.png", 1400),
    "inside-tally": ("img-muh12lkv-897e7e0c.png", 1400),
    "eyes-flash": ("img-muh12kbz-4cce7ef9.png", 1200),
    # Текстуры для фонов секций (лежат под контентом с низкой непрозрачностью)
    "tex-concrete": ("img-muh42hd5-ce37cb81.png", 1200),
    "tex-rust": ("img-muh42fu9-0e1f93f3.png", 1200),
    "tex-tiles": ("img-muh42k0q-3ab229cd.png", 1200),
    # Атмосферные «полосы» между секциями
    "band-corridor": ("img-muh42jsf-e7be8f53.png", 1400),
    "band-stairs": ("img-muh43i9m-cbb43613.png", 1600),
    "band-hall": ("img-muh43ih2-57e99478.png", 1600),
    "band-mask": ("img-muh43jic-6c04ef64.png", 1600),
    "band-ward": ("img-muh43hfy-ca635f30.png", 1600),
    "band-handprint": ("img-muh4493p-a210181c.png", 1400),
    "band-mirror": ("img-muh44cfv-a530b7ad.png", 1400),
}

# Качество JPEG по назначению: фоновые текстуры лежат под контентом
# с непрозрачностью 12–20 %, поэтому их можно сжать сильнее без потерь
# на глаз — это экономит трафик на мобильных.
QUALITY_BY_PREFIX: dict[str, int] = {
    "tex-": 70,
    "band-": 78,
}
DEFAULT_QUALITY = 82
TEXTURE_WIDTHS = ("tex-",)


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    placeholders: dict[str, str] = {}
    report: list[str] = []

    for name, (source_name, width) in JOBS.items():
        source_path = SOURCE / source_name
        if not source_path.exists():
            report.append(f"!! нет файла {source_name} — пропускаю {name}")
            continue

        image = Image.open(source_path).convert("RGB")
        original = image.size

        if image.width > width:
            height = round(image.height * width / image.width)
            image = image.resize((width, height), Image.LANCZOS)

        out_path = TARGET / f"{name}.jpg"
        quality = next(
            (value for prefix, value in QUALITY_BY_PREFIX.items() if name.startswith(prefix)),
            DEFAULT_QUALITY,
        )
        image.save(out_path, "JPEG", quality=quality, optimize=True, progressive=True)

        # LQIP: 16 px по ширине + лёгкий blur, упакованный в data-URI
        small = image.copy()
        small.thumbnail((16, 16), Image.LANCZOS)
        small = small.filter(ImageFilter.GaussianBlur(0.6))
        buffer = io.BytesIO()
        small.save(buffer, "JPEG", quality=55)
        payload = base64.b64encode(buffer.getvalue()).decode("ascii")
        placeholders[name] = f"data:image/jpeg;base64,{payload}"

        size_kb = out_path.stat().st_size / 1024
        report.append(
            f"{name}.jpg  {original[0]}x{original[1]} -> {image.width}x{image.height}  {size_kb:.0f} KB"
        )

    out_ts = ROOT / "lib" / "image-placeholders.ts"
    body = ",\n".join(f'  "{key}": "{value}"' for key, value in placeholders.items())
    out_ts.write_text(
        "// АВТОГЕНЕРАЦИЯ: scripts/optimize-images.py\n"
        "// Крошечные превью (data-URI), чтобы карточки и hero не «прыгали» при загрузке.\n\n"
        "export const IMAGE_PLACEHOLDERS: Record<string, string> = {\n"
        f"{body},\n"
        "};\n",
        encoding="utf-8",
    )

    print("\n".join(report))
    print(f"\nplaceholder-файл: {out_ts}")


if __name__ == "__main__":
    main()
