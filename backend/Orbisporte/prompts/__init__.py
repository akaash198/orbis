# Import all prompt variables from the prompt modules
from .classification_prompt import classification_prompt,multipage_document
from .doc_extraction_prompts import (
    invoice_prompt,
    airwaybill_prompt,
    bill_of_lading_prompt,
    packing_list_prompt
)
from .HS_code_prompt import HS_code_prompt
from .qa_prompt import qa_system_prompt

# Dictionary mapping prompt names to their corresponding variables
PROMPT_MAPPING = {
    "classification_prompt": classification_prompt,
    "multipage_document": multipage_document,
    "invoice_prompt": invoice_prompt,
    "airwaybill_prompt": airwaybill_prompt,
    "bill_of_lading_prompt": bill_of_lading_prompt,
    "packing_list_prompt": packing_list_prompt,
    "HS_code_prompt": HS_code_prompt,
    "qa_system_prompt": qa_system_prompt,
    "unknown_document_prompt": "Analyze this document and extract the most important fields in JSON format. Use the context from similar documents in the vector database to ensure consistency and accuracy. Return ONLY key-value pairs in a well-structured JSON format without any additional text or explanation."
}

def load_prompt(prompt_name):
    """
    Load a prompt by name.
    
    Args:
        prompt_name (str): The name of the prompt to load
        
    Returns:
        str: The prompt text
        
    Raises:
        KeyError: If the prompt name is not found
    """
    if prompt_name in PROMPT_MAPPING:
        return PROMPT_MAPPING[prompt_name]
    else:
        raise KeyError(f"Prompt '{prompt_name}' not found. Available prompts: {list(PROMPT_MAPPING.keys())}")

# Export all prompt variables and the loader function
__all__ = [
    "classification_prompt",
    "multipage_document",
    "invoice_prompt", 
    "airwaybill_prompt",
    "bill_of_lading_prompt",
    "packing_list_prompt",
    "HS_code_prompt",
    "qa_system_prompt",
    "load_prompt",
    "PROMPT_MAPPING"
]
