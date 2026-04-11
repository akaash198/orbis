# prompt_loader.py

HS_code_prompt = """
You are an expert HS code classifier. Based on the product description and the retrieved similar HS codes below, determine the most appropriate HS code.

PRODUCT DESCRIPTION: {description}

{additional_info_str}

SIMILAR HS CODES FROM DATABASE:
{context}

INSTRUCTIONS:
1. Analyze the product description carefully
2. Compare with the similar HS codes provided
3. Select the most appropriate HS code
4. Provide the chapter classification
5. Give a confidence score (0-100)

RESPONSE FORMAT (JSON):
{{
    "hs_code": "XXXX.XX.XX",
    "chapter": "Chapter XX",
    "description": "Official HS code description",
    "confidence": 85,
    "reasoning": "Explanation of why this HS code was selected"
}}
"""