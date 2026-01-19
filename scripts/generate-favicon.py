#!/usr/bin/env python3
"""
Generate favicon with sky blue background and white "P" in ADLaM Display font.
"""

import os
from pathlib import Path
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
FONT_PATH = PROJECT_ROOT / "assets/fonts/adlam-display-latin-400-normal.woff2"
FAVICON_DIR = PROJECT_ROOT / "assets/favicon"
TTF_PATH = PROJECT_ROOT / "assets/fonts/adlam-display-latin-400-normal.ttf"

# Colors
SKY_BLUE = "#87CEEB"  # Classic sky blue
WHITE = "#FFFFFF"

# Favicon sizes to generate
SIZES = [16, 32, 48, 180, 192, 512]


def convert_woff2_to_ttf():
    """Convert WOFF2 font to TTF format for PIL compatibility."""
    if TTF_PATH.exists():
        print(f"TTF already exists: {TTF_PATH}")
        return TTF_PATH

    print(f"Converting {FONT_PATH} to TTF...")
    font = TTFont(FONT_PATH)
    font.flavor = None  # Remove WOFF2 compression
    font.save(TTF_PATH)
    print(f"Saved TTF to: {TTF_PATH}")
    return TTF_PATH


def create_favicon(size: int, font_path: Path) -> Image.Image:
    """Create a single favicon at the specified size."""
    # Create image with sky blue background
    img = Image.new("RGBA", (size, size), SKY_BLUE)
    draw = ImageDraw.Draw(img)

    # Calculate font size (roughly 70% of image size for good proportions)
    font_size = int(size * 0.7)

    try:
        font = ImageFont.truetype(str(font_path), font_size)
    except Exception as e:
        print(f"Warning: Could not load font, using default: {e}")
        font = ImageFont.load_default()

    # Get text bounding box for centering
    text = "P"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Center the text (with slight vertical adjustment for visual balance)
    x = (size - text_width) / 2 - bbox[0]
    y = (size - text_height) / 2 - bbox[1]

    # Draw the "P"
    draw.text((x, y), text, fill=WHITE, font=font)

    return img


def generate_ico(images: dict, output_path: Path):
    """Generate .ico file with multiple sizes."""
    # ICO format typically includes 16, 32, and 48 pixel sizes
    ico_sizes = [16, 32, 48]
    ico_images = [images[s] for s in ico_sizes if s in images]

    if ico_images:
        # Save with all sizes embedded
        ico_images[0].save(
            output_path,
            format="ICO",
            sizes=[(img.width, img.height) for img in ico_images],
            append_images=ico_images[1:]
        )
        print(f"Generated: {output_path}")


def main():
    # Create favicon directory
    FAVICON_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Favicon directory: {FAVICON_DIR}")

    # Convert font
    ttf_path = convert_woff2_to_ttf()

    # Generate favicons at different sizes
    images = {}
    for size in SIZES:
        img = create_favicon(size, ttf_path)
        images[size] = img

        # Save PNG
        png_path = FAVICON_DIR / f"favicon-{size}x{size}.png"
        img.save(png_path, "PNG")
        print(f"Generated: {png_path}")

    # Generate special named files
    # Apple touch icon (180x180)
    apple_touch = FAVICON_DIR / "apple-touch-icon.png"
    images[180].save(apple_touch, "PNG")
    print(f"Generated: {apple_touch}")

    # Android/PWA icons
    android_192 = FAVICON_DIR / "android-chrome-192x192.png"
    images[192].save(android_192, "PNG")
    print(f"Generated: {android_192}")

    android_512 = FAVICON_DIR / "android-chrome-512x512.png"
    images[512].save(android_512, "PNG")
    print(f"Generated: {android_512}")

    # Generate .ico file
    ico_path = FAVICON_DIR / "favicon.ico"
    generate_ico(images, ico_path)

    # Also copy favicon.ico to project root for legacy browser support
    root_ico = PROJECT_ROOT / "favicon.ico"
    images[32].save(root_ico, "ICO", sizes=[(32, 32)])
    print(f"Generated: {root_ico}")

    print("\nFavicon generation complete!")
    print(f"\nGenerated files in {FAVICON_DIR}:")
    for f in sorted(FAVICON_DIR.iterdir()):
        print(f"  - {f.name}")


if __name__ == "__main__":
    main()
