import re
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from rapidfuzz import fuzz
from app.config import FUZZY_MATCH_THRESHOLD

RULES_JSON_PATH = Path(__file__).resolve().parent.parent / "rules" / "synonyms.json"

# Common nutrition table tokens that should NOT be mistaken for legal declarations
NUTRITION_NOISE_REGEX = re.compile(
    r"(?i)\b(?:g\s*,\s*mg|mg\s*,\s*ug|qty\s*per\s*serving|qty\s*per\s*100|serving\s*size|"
    r"nutrition\s*info|calcium\s*carbonate|iron\s*sulphate|folic\s*acid|total\s*fat|"
    r"saturated\s*fat|carbohydrate|sodium|cholesterol|protein|kj\s*\(|kcal|insert\s*any\s*other|"
    r"nutrient\s*or\s*biologically|active\s*substance\s*to\s*be|as\s*appropriate)\b"
)

# Common allergen warning tokens that should NOT be mistaken for commodity generic names
ALLERGEN_WARNING_REGEX = re.compile(
    r"(?i)\b(?:warning\s*:\s*the\s*product\s*may|not\s*be\s*suitable\s*for\s*asthma|"
    r"allergy\s*sufferers|phenylketonurics|contains\s*phenylalanine|may\s*contain\s*traces)\b"
)

class FieldMapper:
    def __init__(self):
        with open(RULES_JSON_PATH, "r", encoding="utf-8") as f:
            self.rules_config = json.load(f)

    def map_extracted_fields(
        self,
        ocr_blocks_by_image: List[List[Dict[str, Any]]],
        product_type: str = "general"
    ) -> Dict[str, Any]:
        """
        Maps OCR text blocks to mandatory Legal Metrology fields using 2D spatial clustering,
        domain regex, and strict synonym validation.
        """
        p_type = "medicine" if product_type.lower() in ["medicine", "pharma", "pharmaceutical"] else "general"
        fields_config = self.rules_config.get(p_type, self.rules_config["general"])["fields"]

        # Flatten blocks with image tracking
        all_blocks: List[Dict[str, Any]] = []
        for img_idx, blocks in enumerate(ocr_blocks_by_image):
            for b_idx, block in enumerate(blocks):
                block_copy = dict(block)
                block_copy["global_block_idx"] = len(all_blocks)
                block_copy["image_index"] = img_idx
                block_copy["local_block_idx"] = b_idx
                all_blocks.append(block_copy)

        mapped_results: Dict[str, Any] = {}
        claimed_block_indices = set()

        # Priority 1: High-confidence specific fields (Net Quantity, Expiry/Date, MRP, Country of Origin)
        priority_order = [
            "net_quantity",
            "mfg_pkd_date",
            "expiry_date",
            "mrp",
            "country_of_origin",
            "manufacturer_packer_importer",
            "consumer_care",
            "batch_number",
            "mfg_license_no",
            "generic_name",
            "dosage_composition",
            "storage_instructions",
            "schedule_drug_warning"
        ]

        ordered_field_keys = [k for k in priority_order if k in fields_config]
        # Append any remaining fields
        for k in fields_config:
            if k not in ordered_field_keys:
                ordered_field_keys.append(k)

        for field_key in ordered_field_keys:
            field_spec = fields_config[field_key]
            best_match = self._find_best_field_match(
                field_key=field_key,
                field_spec=field_spec,
                all_blocks=all_blocks,
                blocks_by_image=ocr_blocks_by_image,
                claimed_indices=claimed_block_indices
            )
            mapped_results[field_key] = best_match

        return mapped_results

    def _find_best_field_match(
        self,
        field_key: str,
        field_spec: Dict[str, Any],
        all_blocks: List[Dict[str, Any]],
        blocks_by_image: List[List[Dict[str, Any]]],
        claimed_indices: set
    ) -> Dict[str, Any]:
        synonyms: List[str] = field_spec.get("synonyms", [])
        value_regex: Optional[str] = field_spec.get("value_regex")
        
        candidates: List[Dict[str, Any]] = []

        for block in all_blocks:
            idx = block.get("global_block_idx")
            text = block.get("text", "").strip()
            if not text:
                continue

            text_lower = text.lower()
            confidence = block.get("confidence", 0.9)
            img_idx = block.get("image_index", 0)

            # Skip nutrition table noise for non-nutrition fields
            if field_key not in ["net_quantity", "dosage_composition"]:
                if NUTRITION_NOISE_REGEX.search(text):
                    continue

            # Skip allergen warnings for generic name
            if field_key == "generic_name" and ALLERGEN_WARNING_REGEX.search(text):
                continue

            # -----------------------------------------------------------------
            # 1. FIELD-SPECIFIC SPECIALIZED PATTERNS (Highest Precision)
            # -----------------------------------------------------------------
            if field_key == "net_quantity":
                # Look for standalone or prefixed net quantity declaration
                nq_match = re.search(
                    r"(?:net\s*(?:weight|wt|quantity|qty|content|contents)?\s*[:\.\s]*)?(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|gram|grams|mg|l|ltr|litre|litres|ml|millilitre|m|cm|units?|pcs?|count)\b",
                    text,
                    re.IGNORECASE
                )
                if nq_match and not re.search(r"(?:per|serving|100g|sodium|fat|protein|carbo|energy)", text, re.I):
                    candidates.append({
                        "found": True,
                        "matched_synonym": "Net Quantity",
                        "extracted_value": nq_match.group(0).strip(),
                        "confidence": confidence,
                        "is_low_confidence": block.get("is_low_confidence", False),
                        "bounding_box": block.get("bbox_norm"),
                        "bbox_pixels": block.get("bbox_pixels"),
                        "image_index": img_idx,
                        "match_score": 150,
                        "block_idx": idx
                    })
                    continue

            elif field_key in ["mfg_pkd_date", "expiry_date"]:
                # Look for Use By / Expiry / Mfg Date declarations
                date_prefix_match = re.search(
                    r"(?:use\s*by|best\s*before|exp(?:iry)?(?:\s*date)?|mfg(?:\s*date)?|pkd(?:\s*date)?|packed)\s*[:\.\-\s]*"
                    r"(\d{1,2}[-/\.\s]\d{1,2}[-/\.\s]\d{2,4}|\b(?:0[1-9]|1[0-2])[-/]\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-/\.\s]+\d{2,4}\b)",
                    text,
                    re.IGNORECASE
                )
                if date_prefix_match:
                    candidates.append({
                        "found": True,
                        "matched_synonym": "Date Declaration",
                        "extracted_value": date_prefix_match.group(0).strip(),
                        "confidence": confidence,
                        "is_low_confidence": block.get("is_low_confidence", False),
                        "bounding_box": block.get("bbox_norm"),
                        "bbox_pixels": block.get("bbox_pixels"),
                        "image_index": img_idx,
                        "match_score": 140,
                        "block_idx": idx
                    })
                    continue

            elif field_key == "country_of_origin":
                coo_match = re.search(
                    r"(?:product\s*of|made\s*in|country\s*of\s*origin|manufactured\s*in)\s*[:\.\-\s]*([A-Za-z\s]{3,30})",
                    text,
                    re.IGNORECASE
                )
                if coo_match:
                    candidates.append({
                        "found": True,
                        "matched_synonym": "Product of",
                        "extracted_value": coo_match.group(0).strip(),
                        "confidence": confidence,
                        "is_low_confidence": block.get("is_low_confidence", False),
                        "bounding_box": block.get("bbox_norm"),
                        "bbox_pixels": block.get("bbox_pixels"),
                        "image_index": img_idx,
                        "match_score": 140,
                        "block_idx": idx
                    })
                    continue

            elif field_key == "manufacturer_packer_importer":
                # Look for manufacturer header
                if re.search(r"\b(?:manufactured|mfd|packed|pkd|marketed|mktd)\s*\.?\s*by\b", text, re.I):
                    extracted_mfr = self._extract_manufacturer_spatially(
                        header_block=block,
                        all_blocks_in_img=blocks_by_image[img_idx] if img_idx < len(blocks_by_image) else []
                    )
                    candidates.append({
                        "found": True,
                        "matched_synonym": "Manufactured By",
                        "extracted_value": extracted_mfr["value"],
                        "confidence": extracted_mfr["confidence"],
                        "is_low_confidence": block.get("is_low_confidence", False),
                        "bounding_box": extracted_mfr["bbox"],
                        "bbox_pixels": extracted_mfr["bbox_pixels"],
                        "image_index": img_idx,
                        "match_score": 145,
                        "block_idx": idx
                    })
                    continue

            # -----------------------------------------------------------------
            # 2. SYNONYM MATCHING WITH WORD BOUNDARIES
            # -----------------------------------------------------------------
            matched_synonym = None
            highest_fuzzy_score = 0

            for syn in synonyms:
                syn_lower = syn.lower()
                
                # For short synonyms (<= 4 chars like mfg, pkd, mrp, rx), require exact word boundary
                if len(syn) <= 4:
                    if re.search(r"\b" + re.escape(syn_lower) + r"\b", text_lower):
                        matched_synonym = syn
                        highest_fuzzy_score = 100
                        break
                    continue

                # Direct word boundary or exact match
                if re.search(r"\b" + re.escape(syn_lower) + r"\b", text_lower):
                    matched_synonym = syn
                    highest_fuzzy_score = 100
                    break

                # Fuzzy token ratio (NOT partial_ratio, to avoid 2-letter substring accidents)
                score = fuzz.token_sort_ratio(syn_lower, text_lower)
                if score >= FUZZY_MATCH_THRESHOLD and score > highest_fuzzy_score:
                    highest_fuzzy_score = score
                    matched_synonym = syn

            if matched_synonym:
                # Content sanity check:
                # If consumer care matched, ensure it actually has contact / phone / email / helpline
                if field_key == "consumer_care":
                    if not re.search(r"(?:1800|\d{10}|@|help|care|feedback|tel|phone|contact)", text_lower):
                        continue

                extracted_val = self._extract_field_value_spatially(
                    field_key=field_key,
                    synonym=matched_synonym,
                    block=block,
                    all_blocks_in_img=blocks_by_image[img_idx] if img_idx < len(blocks_by_image) else [],
                    value_regex=value_regex
                )

                if extracted_val and extracted_val["value"]:
                    candidates.append({
                        "found": True,
                        "matched_synonym": matched_synonym,
                        "extracted_value": extracted_val["value"],
                        "confidence": min(confidence, extracted_val.get("confidence", confidence)),
                        "is_low_confidence": block.get("is_low_confidence", False),
                        "bounding_box": extracted_val.get("bbox", block.get("bbox_norm")),
                        "bbox_pixels": extracted_val.get("bbox_pixels", block.get("bbox_pixels")),
                        "image_index": img_idx,
                        "match_score": highest_fuzzy_score + 25,
                        "block_idx": idx
                    })

            # -----------------------------------------------------------------
            # 3. DIRECT REGEX FALLBACK
            # -----------------------------------------------------------------
            elif value_regex:
                rgx_match = re.search(value_regex, text, re.IGNORECASE)
                if rgx_match:
                    match_text = rgx_match.group(0).strip()
                    if len(match_text) >= 3 and not NUTRITION_NOISE_REGEX.search(text):
                        candidates.append({
                            "found": True,
                            "matched_synonym": f"Pattern ({field_spec['name']})",
                            "extracted_value": text,
                            "confidence": confidence,
                            "is_low_confidence": block.get("is_low_confidence", False),
                            "bounding_box": block.get("bbox_norm"),
                            "bbox_pixels": block.get("bbox_pixels"),
                            "image_index": img_idx,
                            "match_score": 75,
                            "block_idx": idx
                        })

        # -----------------------------------------------------------------
        # 4. SPECIAL FALLBACK: Generic Name from Top of Package
        # -----------------------------------------------------------------
        if field_key == "generic_name" and not candidates:
            # Pick prominent non-noise text blocks from top 25% of image
            top_blocks = [
                b for b in all_blocks 
                if b.get("center_y", 0.5) < 0.25 
                and not NUTRITION_NOISE_REGEX.search(b.get("text", ""))
                and not ALLERGEN_WARNING_REGEX.search(b.get("text", ""))
                and len(b.get("text", "")) > 3
            ]
            if top_blocks:
                top_blocks.sort(key=lambda b: (b.get("center_y", 0), b.get("center_x", 0)))
                # Combine top line elements (e.g. "Breakfast Low Fat cereals")
                combined_name = " ".join([b["text"] for b in top_blocks[:4]])
                if combined_name:
                    merged_norm, merged_pix = self._merge_multiple_bboxes(top_blocks[:4])
                    candidates.append({
                        "found": True,
                        "matched_synonym": "Product Header",
                        "extracted_value": combined_name,
                        "confidence": 0.95,
                        "is_low_confidence": False,
                        "bounding_box": merged_norm,
                        "bbox_pixels": merged_pix,
                        "image_index": 0,
                        "match_score": 90,
                        "block_idx": top_blocks[0].get("global_block_idx")
                    })

        if not candidates:
            return {
                "found": False,
                "matched_synonym": None,
                "extracted_value": None,
                "confidence": 0.0,
                "is_low_confidence": False,
                "bounding_box": None,
                "bbox_pixels": None,
                "image_index": None
            }

        # Select highest scoring candidate not already claimed by a higher-priority field
        candidates.sort(key=lambda c: (c["match_score"], c["confidence"]), reverse=True)
        for cand in candidates:
            b_idx = cand.get("block_idx")
            if b_idx is not None and b_idx in claimed_indices and len(candidates) > 1:
                continue
            if b_idx is not None:
                claimed_indices.add(b_idx)
            return cand

        return candidates[0]

    def _extract_manufacturer_spatially(
        self,
        header_block: Dict[str, Any],
        all_blocks_in_img: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Collects the company name and postal address lines spatially beneath the header."""
        header_text = header_block.get("text", "").strip()
        h_cx = header_block.get("center_x", 0.5)
        h_cy = header_block.get("center_y", 0.5)

        # Collect subsequent lines below the header within vertical distance of ~0.25
        address_blocks = []
        for b in all_blocks_in_img:
            b_cx = b.get("center_x", 0.5)
            b_cy = b.get("center_y", 0.5)
            # Must be below header
            if b_cy > h_cy and b_cy < h_cy + 0.25:
                # Horizontally close (same column)
                if abs(b_cx - h_cx) < 0.20:
                    # Ignore nutrition noise
                    if not NUTRITION_NOISE_REGEX.search(b.get("text", "")):
                        address_blocks.append(b)

        address_blocks.sort(key=lambda b: b.get("center_y", 0))

        if address_blocks:
            lines = [b.get("text", "") for b in address_blocks]
            full_val = f"{header_text} " + ", ".join(lines)
            merged_norm, merged_pix = self._merge_multiple_bboxes([header_block] + address_blocks)
            avg_conf = sum([b.get("confidence", 0.9) for b in [header_block] + address_blocks]) / (len(address_blocks) + 1)
            return {
                "value": full_val,
                "bbox": merged_norm,
                "bbox_pixels": merged_pix,
                "confidence": round(avg_conf, 3)
            }

        return {
            "value": header_text,
            "bbox": header_block.get("bbox_norm"),
            "bbox_pixels": header_block.get("bbox_pixels"),
            "confidence": header_block.get("confidence", 0.9)
        }

    def _extract_field_value_spatially(
        self,
        field_key: str,
        synonym: str,
        block: Dict[str, Any],
        all_blocks_in_img: List[Dict[str, Any]],
        value_regex: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        text = block.get("text", "").strip()
        syn_lower = synonym.lower()

        # Same-block delimiter (e.g. "Net Wt: 500g" or "USE BY: 01/12/2010")
        delimiters = [":", "-", "=", "–", "."]
        for d in delimiters:
            if d in text:
                parts = text.split(d, 1)
                if len(parts) == 2 and fuzz.partial_ratio(syn_lower, parts[0].lower()) >= 70:
                    val_candidate = parts[1].strip()
                    if val_candidate:
                        return {
                            "value": val_candidate,
                            "bbox": block.get("bbox_norm"),
                            "bbox_pixels": block.get("bbox_pixels"),
                            "confidence": block.get("confidence", 0.9)
                        }

        # Spatial search: neighbor to the right or directly below
        b_cx = block.get("center_x", 0.5)
        b_cy = block.get("center_y", 0.5)

        candidates_spatial = []
        for other in all_blocks_in_img:
            if other.get("text") == text:
                continue
            o_cx = other.get("center_x", 0.5)
            o_cy = other.get("center_y", 0.5)

            # Horizontal neighbor (same line, to the right)
            if abs(o_cy - b_cy) < 0.04 and o_cx > b_cx and (o_cx - b_cx) < 0.35:
                candidates_spatial.append(other)
            # Vertical neighbor (below header, same column)
            elif o_cy > b_cy and (o_cy - b_cy) < 0.12 and abs(o_cx - b_cx) < 0.15:
                candidates_spatial.append(other)

        if candidates_spatial:
            if value_regex:
                for c in candidates_spatial:
                    if re.search(value_regex, c.get("text", ""), re.IGNORECASE):
                        merged_norm, merged_pix = self._merge_bboxes(block, c)
                        return {
                            "value": c.get("text"),
                            "bbox": merged_norm,
                            "bbox_pixels": merged_pix,
                            "confidence": (block.get("confidence", 0.9) + c.get("confidence", 0.9)) / 2
                        }
            
            # If text in header is just the label, take the closest spatial block
            if len(text) <= len(synonym) + 4:
                closest = candidates_spatial[0]
                merged_norm, merged_pix = self._merge_bboxes(block, closest)
                return {
                    "value": closest.get("text"),
                    "bbox": merged_norm,
                    "bbox_pixels": merged_pix,
                    "confidence": (block.get("confidence", 0.9) + closest.get("confidence", 0.9)) / 2
                }

        return {
            "value": text,
            "bbox": block.get("bbox_norm"),
            "bbox_pixels": block.get("bbox_pixels"),
            "confidence": block.get("confidence", 0.9)
        }

    def _merge_bboxes(self, b1: Dict[str, Any], b2: Dict[str, Any]) -> Tuple[Dict[str, float], Dict[str, int]]:
        return self._merge_multiple_bboxes([b1, b2])

    def _merge_multiple_bboxes(self, blocks: List[Dict[str, Any]]) -> Tuple[Dict[str, float], Dict[str, int]]:
        if not blocks:
            return {"x": 0, "y": 0, "width": 0, "height": 0}, {"x": 0, "y": 0, "width": 0, "height": 0}

        min_x = min([b.get("bbox_norm", {}).get("x", 0) for b in blocks])
        min_y = min([b.get("bbox_norm", {}).get("y", 0) for b in blocks])
        max_x = max([b.get("bbox_norm", {}).get("x", 0) + b.get("bbox_norm", {}).get("width", 0) for b in blocks])
        max_y = max([b.get("bbox_norm", {}).get("y", 0) + b.get("bbox_norm", {}).get("height", 0) for b in blocks])

        merged_norm = {
            "x": round(min_x, 4),
            "y": round(min_y, 4),
            "width": round(max_x - min_x, 4),
            "height": round(max_y - min_y, 4)
        }

        p_min_x = min([b.get("bbox_pixels", {}).get("x", 0) for b in blocks])
        p_min_y = min([b.get("bbox_pixels", {}).get("y", 0) for b in blocks])
        p_max_x = max([b.get("bbox_pixels", {}).get("x", 0) + b.get("bbox_pixels", {}).get("width", 0) for b in blocks])
        p_max_y = max([b.get("bbox_pixels", {}).get("y", 0) + b.get("bbox_pixels", {}).get("height", 0) for b in blocks])

        merged_pix = {
            "x": p_min_x,
            "y": p_min_y,
            "width": p_max_x - p_min_x,
            "height": p_max_y - p_min_y
        }

        return merged_norm, merged_pix

# Global instance
field_mapper = FieldMapper()
