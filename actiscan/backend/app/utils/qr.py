import qrcode
import io
import base64
from pathlib import Path


def generate_qr_base64(asset_code: str, asset_id: str) -> str:
    """Generate QR code as base64 data URL for an asset."""
    data = f"actiscan://asset/{asset_id}?code={asset_code}"

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#1A2B4A", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def generate_asset_code(sequential: int) -> str:
    """Generate a unique asset code like ACT-2024-0001."""
    from datetime import datetime
    year = datetime.now().year
    return f"ACT-{year}-{sequential:04d}"
