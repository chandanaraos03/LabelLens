import cv2
import numpy as np
import re
from typing import List, Dict, Any, Optional
from rapidocr_onnxruntime import RapidOCR
from app.config import OCR_CONFIDENCE_THRESHOLD
from app.ocr.preprocessor import ImagePreprocessor

class OCREngine:
    def __init__(self):
        # Initialize RapidOCR with PP-OCRv4 ONNX model
        self.engine = RapidOCR()

    def extract_text_and_boxes(
        self,
        image_bgr: np.ndarray,
        image_index: int = 0
    ) -> Dict[str, Any]:
        """
        Preprocesses image with dynamic upscaling, runs PP-OCRv4 detection and recognition.
        Returns:
            - blocks: list of detected text items with normalized bboxes and confidence
            - full_text: concatenated recognized text
            - display_image: enhanced BGR image
        """
        display_img, preprocessed_img = ImagePreprocessor.preprocess_pipeline(image_bgr)
        h, w = display_img.shape[:2]

        # Multi-scale adaptive resolution: If image is low-resolution, upscale for crisp OCR
        scale = 1.0
        min_dim = min(h, w)
        max_dim = max(h, w)
        if min_dim < 700 or max_dim < 1200:
            scale = 2.0
        elif min_dim < 900:
            scale = 1.5

        if scale != 1.0:
            ocr_input = cv2.resize(
                preprocessed_img,
                (int(w * scale), int(h * scale)),
                interpolation=cv2.INTER_LANCZOS4
            )
        else:
            ocr_input = preprocessed_img

        # Run RapidOCR engine
        ocr_result, elapse = self.engine(ocr_input)

        blocks: List[Dict[str, Any]] = []
        full_text_lines: List[str] = []

        if ocr_result:
            for item in ocr_result:
                # item structure: [box_points, text, confidence]
                box_pts, text, score = item
                text_clean = str(text).strip()
                score_val = float(score) if score is not None else 0.0

                if not text_clean:
                    continue

                # Standard text normalization for common OCR token splits
                text_clean = self._normalize_ocr_text(text_clean)

                # Rescale box points back to original image coordinates
                raw_box = [[float(pt[0]) / scale, float(pt[1]) / scale] for pt in box_pts]
                
                # Compute Axis-Aligned Bounding Box (AABB)
                xs = [pt[0] for pt in raw_box]
                ys = [pt[1] for pt in raw_box]
                min_x, max_x = max(0.0, min(xs)), min(float(w), max(xs))
                min_y, max_y = max(0.0, min(ys)), min(float(h), max(ys))

                # Normalized coordinates (0.0 to 1.0)
                norm_box = {
                    "x": round(min_x / w, 4),
                    "y": round(min_y / h, 4),
                    "width": round((max_x - min_x) / w, 4),
                    "height": round((max_y - min_y) / h, 4)
                }

                is_low_conf = score_val < OCR_CONFIDENCE_THRESHOLD

                block_dict = {
                    "text": text_clean,
                    "confidence": round(score_val, 3),
                    "is_low_confidence": is_low_conf,
                    "polygon": raw_box,
                    "bbox_norm": norm_box,
                    "bbox_pixels": {
                        "x": int(min_x),
                        "y": int(min_y),
                        "width": int(max_x - min_x),
                        "height": int(max_y - min_y)
                    },
                    "center_x": round((min_x + max_x) / (2.0 * w), 4),
                    "center_y": round((min_y + max_y) / (2.0 * h), 4),
                    "image_index": image_index,
                    "image_width": w,
                    "image_height": h
                }

                blocks.append(block_dict)
                full_text_lines.append(text_clean)

        return {
            "blocks": blocks,
            "full_text": "\n".join(full_text_lines),
            "image_width": w,
            "image_height": h,
            "display_image": display_img
        }

    def _normalize_ocr_text(self, text: str) -> str:
        """Fixes common OCR punctuation and character artifacts on packaging labels."""
        # Fix middle dots used as colons (e.g. USE BY·01/12/2010 -> USE BY: 01/12/2010)
        t = re.sub(r"([A-Za-z]+)\s*[·•]\s*(\d)", r"\1: \2", text)
        
        # Clean glued common label prefixes (NETWEIGHT500g -> NET WEIGHT: 500g)
        t = re.sub(r"(?i)\bnetweight\s*", "Net Weight: ", t)
        t = re.sub(r"(?i)\bnetwt\s*", "Net Wt: ", t)
        t = re.sub(r"(?i)\bnetqty\s*", "Net Qty: ", t)
        
        # Normalize common typo in "Manufactured By"
        t = re.sub(r"(?i)\bmanutactured\s*by\b", "Manufactured By", t)
        t = re.sub(r"(?i)\bcturedBy\b", "Manufactured By", t)
        t = re.sub(r"(?i)\bpreduct\s*of\b", "Product of", t)
        
        return t.strip()

# Global singleton OCR engine instance
ocr_engine = OCREngine()
