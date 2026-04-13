"""
AA2000 RDIS Resibo — Local OCR Server
Replaces Claude AI with Tesseract OCR + regex parsing.
Run: python server.py
"""

import re
import json
import base64
import random
import string
from datetime import date
from io import BytesIO

import cv2
import numpy as np
import pytesseract
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

# ── Windows users: uncomment and set your Tesseract path ──────────────────────
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

app = Flask(__name__)
CORS(app)  # Allow requests from localhost Vite dev server


# ── Image preprocessing ────────────────────────────────────────────────────────

def preprocess_image(img_array: np.ndarray) -> np.ndarray:
    """Enhance image for better OCR: grayscale → denoise → threshold."""
    gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh


def load_image_from_base64(b64_data: str, media_type: str) -> np.ndarray:
    """Decode base64 image to numpy array for OpenCV."""
    raw = base64.b64decode(b64_data)
    pil_img = Image.open(BytesIO(raw)).convert("RGB")
    return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)


def extract_text(img_array: np.ndarray) -> str:
    """Run Tesseract OCR on preprocessed image."""
    processed = preprocess_image(img_array)
    config = "--psm 6 --oem 3"
    return pytesseract.image_to_string(processed, config=config).strip()


# ── Field parsers ──────────────────────────────────────────────────────────────

def parse_or_number(text: str) -> str:
    patterns = [
        r'(?:O\.?R\.?|OFFICIAL\s+RECEIPT)\s*(?:NO\.?|#|NUMBER)?\s*[:\-]?\s*([A-Z0-9\-]+)',
        r'(?:INVOICE|INV)\s*(?:NO\.?|#)?\s*[:\-]?\s*([A-Z0-9\-]+)',
        r'(?:RECEIPT|RCPT)\s*(?:NO\.?|#)?\s*[:\-]?\s*([A-Z0-9\-]+)',
        r'(?:NO\.|#)\s*([A-Z0-9\-]{4,})',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return f"DOC-{''.join(random.choices(string.digits, k=5))}"


def parse_date(text: str) -> str:
    patterns = [
        r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})',          # 2024-01-15
        r'(\d{1,2}[-/]\d{1,2}[-/]\d{4})',           # 15/01/2024
        r'(\d{1,2}\s+\w+\s+\d{4})',                 # 15 January 2024
        r'(\w+\s+\d{1,2},?\s+\d{4})',               # January 15, 2024
        r'(\d{1,2}-\w{3}-\d{2,4})',                 # 15-Jan-2024
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            raw = m.group(1).strip().replace(',', '')
            # Attempt to normalize to YYYY-MM-DD
            for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y',
                        '%d %B %Y', '%B %d %Y', '%d-%b-%Y', '%d-%b-%y'):
                try:
                    from datetime import datetime
                    return datetime.strptime(raw, fmt).strftime('%Y-%m-%d')
                except ValueError:
                    continue
            return raw
    return date.today().isoformat()


def parse_amount(text: str) -> float:
    patterns = [
        r'(?:GRAND\s+TOTAL|TOTAL\s+AMOUNT|TOTAL\s+DUE|AMOUNT\s+DUE|TOTAL)\s*[:\-]?\s*(?:PHP|₱|P)?\s*([\d,]+\.?\d*)',
        r'(?:PHP|₱|P)\s*([\d,]+\.?\d*)',
        r'(?:AMOUNT|AMT)\s*[:\-]?\s*([\d,]+\.\d{2})',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            try:
                return float(m.group(1).replace(',', ''))
            except ValueError:
                continue
    # Fallback: find largest decimal number in text
    numbers = re.findall(r'\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b', text)
    if numbers:
        vals = [float(n.replace(',', '')) for n in numbers]
        return max(vals)
    return 0.0


def parse_vendor(text: str) -> str:
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    # Skip lines that look like addresses or labels
    skip_patterns = re.compile(
        r'^\d|^tel|^fax|^email|^www|^http|^vat|^tin|^or\s|^invoice|'
        r'receipt|address|city|philippines|manila|quezon|makati',
        re.IGNORECASE
    )
    for line in lines[:6]:
        if len(line) > 3 and not skip_patterns.search(line):
            return line
    return "Unknown Vendor"


def parse_tin(text: str) -> str:
    m = re.search(r'\b(\d{3}[-\s]\d{3}[-\s]\d{3}[-\s]\d{3,5})\b', text)
    return m.group(1).replace(' ', '-') if m else '000-000-000-000'


def parse_document_type(text: str) -> str:
    text_up = text.upper()
    if 'OFFICIAL RECEIPT' in text_up or 'O.R.' in text_up:
        return 'Receipt'
    if 'INVOICE' in text_up:
        return 'Invoice'
    if 'BILL' in text_up:
        return 'Bill'
    return 'Receipt'


def parse_line_items(text: str, total: float) -> list:
    """Extract line items from itemized lists."""
    items = []
    # Look for lines with a price at the end: "Item name   250.00"
    pattern = re.compile(
        r'^(.{3,40}?)\s{2,}([\d,]+\.\d{2})\s*$', re.MULTILINE
    )
    for m in pattern.finditer(text):
        desc = m.group(1).strip()
        price = float(m.group(2).replace(',', ''))
        skip = re.compile(
            r'total|subtotal|vat|tax|amount|change|discount|balance',
            re.IGNORECASE
        )
        if not skip.search(desc) and price > 0:
            items.append({
                'id': str(len(items) + 1),
                'description': desc,
                'qty': 1,
                'price': price,
                'net': price,
            })
    if not items:
        items = [{
            'id': '1',
            'description': 'Extracted Item',
            'qty': 1,
            'price': total,
            'net': total,
        }]
    return items


def compute_confidence(text: str, vendor: str, amount: float, doc_num: str) -> int:
    """Heuristic confidence score based on extraction quality."""
    score = 40  # base
    if vendor != 'Unknown Vendor':
        score += 15
    if amount > 0:
        score += 20
    if doc_num and not doc_num.startswith('DOC-'):
        score += 15
    if len(text) > 200:
        score += 10
    return min(score, 95)


# ── Main OCR pipeline ──────────────────────────────────────────────────────────

def process_image(b64_data: str, media_type: str, filename: str) -> dict:
    img_array = load_image_from_base64(b64_data, media_type)
    raw_text = extract_text(img_array)

    vendor = parse_vendor(raw_text)
    tin = parse_tin(raw_text)
    doc_num = parse_or_number(raw_text)
    doc_date = parse_date(raw_text)
    doc_type = parse_document_type(raw_text)
    total = parse_amount(raw_text)
    vatable = round(total / 1.12, 2)
    vat = round(total - vatable, 2)
    line_items = parse_line_items(raw_text, total)
    confidence = compute_confidence(raw_text, vendor, total, doc_num)

    return {
        'vendor': vendor,
        'taxId': tin,
        'documentNumber': doc_num,
        'documentType': doc_type,
        'date': doc_date,
        'category': 'Expense',
        'expenseCategory': 'Other',
        'currency': 'PHP',
        'totalAmount': total,
        'vatableSales': vatable,
        'vat': vat,
        'zeroRatedSales': 0,
        'lineItems': line_items,
        'confidence': confidence,
        'notes': f'Extracted via local Tesseract OCR. Raw text length: {len(raw_text)} chars.',
        '_rawText': raw_text,  # useful for debugging
    }


# ── Flask routes ───────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'engine': 'tesseract-ocr'})


@app.route('/ocr', methods=['POST'])
def ocr_endpoint():
    """
    Expects JSON body:
    {
      "base64": "<base64 encoded image>",
      "mediaType": "image/jpeg",
      "filename": "receipt.jpg"
    }
    Returns extracted document fields as JSON.
    """
    try:
        body = request.get_json(force=True)
        b64_data = body.get('base64', '')
        media_type = body.get('mediaType', 'image/jpeg')
        filename = body.get('filename', 'document')

        if not b64_data:
            return jsonify({'error': 'No base64 image data provided'}), 400

        result = process_image(b64_data, media_type, filename)
        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("🔍 AA2000 OCR Server starting on http://localhost:5050")
    print("   Engine: Tesseract OCR (no API key required)")
    app.run(host='127.0.0.1', port=5050, debug=False)
