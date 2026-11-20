import cv2
import numpy as np
from typing import Tuple, Optional

class ImagePreprocessor:
    @staticmethod
    def deskew_image(cv_img: np.ndarray) -> np.ndarray:
        """Corrects noticeable skew angles while preserving upright text orientation."""
        try:
            gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY) if len(cv_img.shape) == 3 else cv_img
            thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
            coords = np.column_stack(np.where(thresh > 0))
            if len(coords) < 150:
                return cv_img
                
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            elif angle > 45:
                angle = -(angle - 90)
            else:
                angle = -angle
                
            # Only correct if skew is between 1.5 and 30 degrees
            if 1.5 < abs(angle) < 30:
                (h, w) = cv_img.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                rotated = cv2.warpAffine(
                    cv_img, M, (w, h),
                    flags=cv2.INTER_CUBIC,
                    borderMode=cv2.BORDER_REPLICATE
                )
                return rotated
        except Exception:
            pass
        return cv_img

    @staticmethod
    def enhance_contrast_clahe(cv_img: np.ndarray) -> np.ndarray:
        """Applies gentle CLAHE on luminance to balance lighting without creating text halos."""
        try:
            if len(cv_img.shape) == 3:
                lab = cv2.cvtColor(cv_img, cv2.COLOR_BGR2LAB)
                l_channel, a_channel, b_channel = cv2.split(lab)
                clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
                cl = clahe.apply(l_channel)
                merged = cv2.merge((cl, a_channel, b_channel))
                return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
            else:
                clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
                return clahe.apply(cv_img)
        except Exception:
            return cv_img

    @staticmethod
    def remove_noise(cv_img: np.ndarray) -> np.ndarray:
        """Gentle edge-preserving bilateral filter that protects fine text characters."""
        try:
            return cv2.bilateralFilter(cv_img, d=5, sigmaColor=25, sigmaSpace=25)
        except Exception:
            return cv_img

    @staticmethod
    def sharpen_text(cv_img: np.ndarray) -> np.ndarray:
        """Gentle unsharp masking to enhance fine small-print details without grain noise."""
        try:
            gaussian = cv2.GaussianBlur(cv_img, (0, 0), 1.0)
            unsharp = cv2.addWeighted(cv_img, 1.25, gaussian, -0.25, 0)
            return unsharp
        except Exception:
            return cv_img

    @classmethod
    def preprocess_pipeline(cls, image_input: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Runs the full preprocessing pipeline.
        Returns:
            - enhanced_display_bgr: Enhanced image ready for web visualization
            - ocr_ready_img: Fully processed image for OCR recognition
        """
        if len(image_input.shape) == 2:
            bgr = cv2.cvtColor(image_input, cv2.COLOR_GRAY2BGR)
        else:
            bgr = image_input.copy()

        # Step 1: Gentle Deskew
        deskewed = cls.deskew_image(bgr)

        # Step 2: Mild CLAHE Contrast
        contrast_enhanced = cls.enhance_contrast_clahe(deskewed)

        # Step 3: Gentle noise reduction
        denoised = cls.remove_noise(contrast_enhanced)

        # Step 4: Sharpening for OCR
        sharpened = cls.sharpen_text(denoised)

        return contrast_enhanced, sharpened
