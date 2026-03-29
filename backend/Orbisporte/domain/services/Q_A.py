from Orbisporte.infrastructure.get_llm import openai_client
from Orbisporte.prompts import qa_system_prompt

class QAService:
    """Question and Answer service for customs and trade-related queries."""

    def __init__(self):
        """Initialize the QA service."""
        self.client = openai_client()
    
    def answer_question(self, question: str) -> str:
        """
        Answer a question about customs, trade, or document processing.
        
        Args:
            question (str): The question to answer
            
        Returns:
            str: The answer to the question
        """
        try:
            # Use the system prompt from prompts module
            response = self.client.chat.completions.create(
                model="gpt-5-mini",
                messages=[
                    {
                        "role": "system",
                        "content": qa_system_prompt
                    },
                    {
                        "role": "user", 
                        "content": question
                    }
                ],
            )
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            # Log the error and re-raise it 
            print(f"Error getting AI response: {e}")
            raise Exception(f"Unable to process question: {str(e)}")