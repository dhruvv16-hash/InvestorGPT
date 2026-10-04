import logging
from app.config import settings

logger = logging.getLogger("investorgpt.llm_provider")

async def generate_completion(system_prompt: str, user_content: str) -> str:
    """
    A unified LLM provider abstraction for text generation.
    Supports local Ollama or Google Gemini (via google-genai) based on configured settings.
    """
    provider = getattr(settings, "LLM_PROVIDER", "ollama").lower()
    
    if provider == "gemini":
        try:
            from google import genai
            from google.genai import types
            
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            model_name = getattr(settings, "GEMINI_MODEL", "gemini-3.8-flash")
            
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=user_content,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.2
                )
            )
            return response.text
        except Exception as e:
            logger.error(f"Gemini API generation failed: {e}")
            raise
    else:
        # Default to Ollama
        try:
            import ollama
            client = ollama.AsyncClient(host=settings.OLLAMA_HOST)
            # Timeout is managed via client defaults or handled externally
            response = await client.chat(model=settings.OLLAMA_MODEL, messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ])
            return response["message"]["content"]
        except Exception as e:
            logger.error(f"Ollama chat generation failed: {e}")
            raise
